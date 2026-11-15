import { Injectable, Logger } from '@nestjs/common';
import { JsonValue } from '@app/infrastructure/prisma/prisma.types';
import { randomBytes } from 'crypto';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { CurrentTenantPayload } from '@app/modules/auth/decorators/current-tenant.decorator';
import { AppConfig } from '@app/config/app-config';
import { TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { OutboxService } from '@app/modules/outbox/services/outbox.service';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { attemptProviderData } from '@app/modules/payments/views/payment.views';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import {
  PaymentProvider,
  ProviderRefundInput,
  ProviderRefundState,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RefundRepository } from '../repositories/refund.repository';
import { RefundOutcome, RefundProcessorService } from './refund-processor.service';

export const IDEMPOTENCY_SCOPE_CREATE_REFUND = 'refunds.create';
const RECONCILE_BATCH = 25;

type ReservedRefund = Awaited<ReturnType<RefundService['reserve']>>;

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly refundRepository: RefundRepository,
    private readonly intentRepository: PaymentIntentRepository,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly providerAccounts: ProviderAccountResolver,
    private readonly idempotencyService: IdempotencyService,
    private readonly processor: RefundProcessorService,
    private readonly transactions: TransactionRunner,
    private readonly outboxService: OutboxService,
    private readonly config: AppConfig,
  ) {}

  async create(
    tenant: CurrentTenantPayload,
    publicId: string,
    idempotencyKey: string,
    dto: CreateRefundDto,
  ) {
    if (!idempotencyKey?.trim()) throw new AppException(PaymentErrorCode.IDEMPOTENCY_KEY_REQUIRED);
    return this.idempotencyService.execute(
      {
        tenantId: tenant.tenantId,
        scope: IDEMPOTENCY_SCOPE_CREATE_REFUND,
        key: idempotencyKey.trim(),
        requestPayload: {
          publicId,
          amountMinor: dto.amountMinor ?? null,
          reason: dto.reason ?? null,
        },
      },
      async () => {
        const reserved = await this.reserve(tenant.tenantId, publicId, dto);
        const refund = await this.submitToProvider(reserved);
        return {
          resourceType: 'refund',
          resourceId: refund.id,
          response: refund,
          statusCode: refund.status === 'pending' ? 202 : 201,
        };
      },
    );
  }

  async findOne(tenantId: string, publicId: string) {
    const refund = await this.refundRepository.findByPublicId(tenantId, publicId);
    if (!refund) throw new AppException(PaymentErrorCode.REFUND_NOT_FOUND);
    return refund;
  }

  async reconcilePending(limit = RECONCILE_BATCH) {
    const providers = this.providerRegistry.refundQueryable();
    const claimed = await this.refundRepository.claimForReconciliation({
      providerCodes: providers.map((provider) => provider.code),
      limit,
      spacingSeconds: this.config.payment.reconcileSpacingSeconds,
    });
    let applied = 0;
    let errors = 0;
    for (const refund of claimed) {
      try {
        const attempt = refund.payment_attempts;
        if (!attempt) continue;
        const provider = this.providerRegistry.get(attempt.provider_code);
        const input = await this.providerInput(
          provider,
          refund.payment_intents,
          attempt,
          refund,
          refund.amount_minor === refund.payment_intents.total_minor,
        );
        const state = await provider.queryRefund!({
          ...input,
          providerRefundId: refund.provider_refund_id,
          refundCreatedAt: refund.created_at,
        });
        const outcome = await this.applyState(refund.id, state, 'reconciliation', provider.code);
        if (outcome.kind === 'applied') applied += 1;
      } catch (error) {
        errors += 1;
        this.logger.error(
          `Reconcile refund ${refund.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { checked: claimed.length, applied, errors };
  }

  private async reserve(tenantId: string, publicId: string, dto: CreateRefundDto) {
    const found = await this.intentRepository.findByPublicId(tenantId, publicId);
    if (!found) throw new AppException(PaymentErrorCode.PAYMENT_INTENT_NOT_FOUND);

    return this.transactions.run(async (tx) => {
      await this.intentRepository.lockForUpdate(found.id, tx);
      const intent = (await this.intentRepository.findById(found.id, tx))!;
      if (intent.status !== 'succeeded' && intent.status !== 'partially_refunded') {
        throw new AppException(PaymentErrorCode.PAYMENT_INTENT_NOT_REFUNDABLE, {
          message: `Payment intent is ${intent.status} and cannot be refunded`,
        });
      }
      const attempt = intent.attempts.find((item) => item.status === 'succeeded');
      if (!attempt) throw new AppException(PaymentErrorCode.PAYMENT_INTENT_NO_CAPTURED_ATTEMPT);
      const provider = this.providerRegistry.get(attempt.provider_code);
      if (!provider.capabilities().refund || !provider.createRefund) {
        throw new AppException(PaymentErrorCode.REFUND_NOT_SUPPORTED, {
          message: `Provider "${attempt.provider_code}" does not support refunds`,
        });
      }

      const reserved = await this.refundRepository.sumReserved(intent.id, tx);
      const refundable = intent.total_minor - reserved;
      if (refundable <= 0n) throw new AppException(PaymentErrorCode.PAYMENT_INTENT_FULLY_REFUNDED);
      const amount = dto.amountMinor === undefined ? refundable : BigInt(dto.amountMinor);
      if (amount <= 0n) throw new AppException(PaymentErrorCode.REFUND_AMOUNT_INVALID);
      if (amount > refundable) {
        throw new AppException(PaymentErrorCode.REFUND_AMOUNT_EXCEEDS_REFUNDABLE, {
          details: {
            refundableMinor: refundable.toString(),
            requestedMinor: amount.toString(),
          },
        });
      }
      const isFullRefund = reserved === 0n && amount === intent.total_minor;
      if (!isFullRefund && !provider.capabilities().partialRefund) {
        throw new AppException(PaymentErrorCode.PARTIAL_REFUND_NOT_SUPPORTED, {
          message: `Provider "${attempt.provider_code}" does not support partial refunds`,
        });
      }

      const refund = await this.refundRepository.create(
        {
          tenant_id: intent.tenant_id,
          payment_intent_id: intent.id,
          payment_attempt_id: attempt.id,
          customer_id: intent.customer_id,
          public_id: `rf_${randomBytes(6).toString('hex')}`,
          amount_minor: amount,
          currency: intent.currency,
          reason: dto.reason ?? null,
          status: 'pending',
          request_payload: {
            amountMinor: amount.toString(),
            isFullRefund,
            reason: dto.reason ?? null,
          },
          last_reconciled_at: new Date(),
        },
        tx,
      );
      return { refund, intent, attempt, provider, isFullRefund };
    });
  }

  private async submitToProvider({
    refund,
    intent,
    attempt,
    provider,
    isFullRefund,
  }: ReservedRefund) {
    let state: ProviderRefundState;
    try {
      state = await provider.createRefund!(
        await this.providerInput(provider, intent, attempt, refund, isFullRefund),
      );
    } catch (error) {
      this.logger.warn(
        `createRefund ${refund.public_id} failed, keeping pending for reconciliation: ${error instanceof Error ? error.message : String(error)}`,
      );
      return (await this.refundRepository.findById(refund.id))!;
    }
    const outcome = await this.applyState(refund.id, state, 'create', provider.code);
    return outcome.refund;
  }

  private async applyState(
    refundId: string,
    state: ProviderRefundState,
    source: 'create' | 'reconciliation',
    providerCode: string,
  ): Promise<RefundOutcome> {
    const outcome = await this.transactions.run((tx) =>
      this.processor.apply(tx, { refundId, state, source, providerCode }),
    );
    if (outcome.kind === 'applied') {
      for (const eventId of outcome.outboxEventIds) {
        await this.outboxService.dispatchById(eventId).catch(() => undefined);
      }
    }
    return outcome;
  }

  private async providerInput(
    provider: PaymentProvider,
    intent: {
      public_id: string;
      total_minor: bigint;
      currency: string;
      paid_at: Date | null;
      tenant_id: string;
    },
    attempt: {
      id: string;
      started_at: Date;
      request_payload: JsonValue;
      provider_account_id: string | null;
      provider_order_id: string | null;
      provider_payment_id: string | null;
      tenant_id: string;
    },
    refund: { public_id: string; amount_minor: bigint; reason: string | null },
    isFullRefund: boolean,
  ): Promise<ProviderRefundInput> {
    const providerAccount = attempt.provider_account_id
      ? await this.providerAccounts.byId(attempt.provider_account_id)
      : await this.providerAccounts.activeByTenant(attempt.tenant_id, provider.code);
    return {
      tenantId: intent.tenant_id,
      refundPublicId: refund.public_id,
      paymentIntentPublicId: intent.public_id,
      attemptId: attempt.id,
      attemptCreatedAt: attempt.started_at,
      providerOrderId: attempt.provider_order_id,
      providerPaymentId: attempt.provider_payment_id,
      providerData: attemptProviderData(attempt),
      amountMinor: refund.amount_minor,
      currency: intent.currency,
      capturedAmountMinor: intent.total_minor,
      isFullRefund,
      reason: refund.reason,
      paidAt: intent.paid_at,
      providerAccount,
      context: { clientIp: this.config.payment.reconciliationServerIp },
    };
  }
}
