import { Injectable, Logger } from '@nestjs/common';
import {
  InputJson,
  JSON_NULL,
  payment_attempts,
  payment_intent_status,
} from '@app/infrastructure/prisma/prisma.types';
import { randomUUID } from 'crypto';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { CurrentTenantPayload } from '@app/common/decorators/current-tenant.decorator';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import {
  PaymentProvider,
  ProviderCheckoutResult,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { ProviderTransportError } from '@app/modules/providers/shared/provider-http.client';
import { IDEMPOTENCY_SCOPE_CREATE_ATTEMPT } from '../constants/payment.constants';
import { CreatePaymentAttemptDto } from '../dto/create-payment-attempt.dto';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '../repositories/payment-intent.repository';
import {
  attemptProviderData,
  isOpenAttemptStatus,
  serializeNextAction,
  toAttemptView,
} from '../views/payment.views';

const ATTEMPTABLE_INTENT_STATUSES: readonly payment_intent_status[] = [
  'pending',
  'requires_action',
  'failed',
];

type IntentWithAttempts = NonNullable<
  Awaited<ReturnType<PaymentIntentRepository['findByPublicId']>>
>;

@Injectable()
export class PaymentAttemptService {
  private readonly logger = new Logger(PaymentAttemptService.name);

  constructor(
    private readonly intentRepository: PaymentIntentRepository,
    private readonly attemptRepository: PaymentAttemptRepository,
    private readonly providerAccounts: ProviderAccountResolver,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(
    tenant: CurrentTenantPayload,
    publicId: string,
    idempotencyKey: string,
    dto: CreatePaymentAttemptDto,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new AppException(PaymentErrorCode.IDEMPOTENCY_KEY_REQUIRED);
    }
    this.providerRegistry.getForCheckout(dto.providerCode);

    return this.idempotencyService.execute(
      {
        tenantId: tenant.tenantId,
        scope: IDEMPOTENCY_SCOPE_CREATE_ATTEMPT,
        key: idempotencyKey.trim(),
        requestPayload: {
          publicId,
          providerCode: dto.providerCode,
          returnUrl: dto.returnUrl,
          cancelUrl: dto.cancelUrl,
          locale: dto.locale,
        },
      },
      async () => {
        const attempt = await this.createAttempt(tenant, publicId, dto);
        return {
          resourceType: 'payment_attempt',
          resourceId: attempt.id,
          response: toAttemptView(attempt),
          statusCode: 201,
        };
      },
    );
  }

  private async createAttempt(
    tenant: CurrentTenantPayload,
    publicId: string,
    dto: CreatePaymentAttemptDto,
  ) {
    const intent = await this.intentRepository.findByPublicId(tenant.tenantId, publicId);
    if (!intent) throw new AppException(PaymentErrorCode.PAYMENT_INTENT_NOT_FOUND);
    if (intent.status === 'succeeded')
      throw new AppException(PaymentErrorCode.PAYMENT_INTENT_ALREADY_SUCCEEDED);
    if (!ATTEMPTABLE_INTENT_STATUSES.includes(intent.status)) {
      throw new AppException(PaymentErrorCode.PAYMENT_INTENT_NOT_ATTEMPTABLE, {
        message: `Payment intent is ${intent.status} and cannot take a new attempt`,
      });
    }

    const provider = this.providerRegistry.getForCheckout(dto.providerCode);
    const providerAccount = await this.providerAccounts.activeByTenant(
      tenant.tenantId,
      provider.code,
    );
    if (!providerAccount) {
      throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_MISSING, {
        message: `Tenant has no active "${provider.code}" account`,
        details: { reason: 'PROVIDER_ACCOUNT_MISSING' },
      });
    }

    await this.cancelOpenAttempts(intent);

    const attemptId = randomUUID();
    const providerOrderRef = attemptId.replace(/-/g, '');
    const orderNumber = await this.attemptRepository.nextOrderNumber();
    const createdAt = new Date();
    const context = {
      clientIp: dto.clientIp ?? null,
      userAgent: dto.userAgent ?? null,
      locale: dto.locale ?? null,
    };

    let checkout: ProviderCheckoutResult;
    try {
      checkout = await provider.createCheckout({
        tenantId: tenant.tenantId,
        paymentIntentId: intent.id,
        publicId: intent.public_id,
        attemptId,
        orderNumber,
        createdAt,
        amountMinor: intent.total_minor,
        currency: intent.currency,
        title: intent.title,
        returnUrl: dto.returnUrl ?? null,
        cancelUrl: dto.cancelUrl ?? null,
        providerAccountId: providerAccount.id,
        providerAccount,
        providerOrderRef,
        context,
      });
    } catch (error) {
      throw this.toCheckoutError(provider, error);
    }

    return this.attemptRepository.create({
      id: attemptId,
      order_number: orderNumber,
      provider_code: provider.code,
      provider_payment_id: checkout.providerPaymentId ?? null,
      provider_order_id: checkout.providerOrderId ?? providerOrderRef,
      started_at: createdAt,
      expires_at: checkout.expiresAt ?? null,
      request_payload: {
        returnUrl: dto.returnUrl ?? null,
        cancelUrl: dto.cancelUrl ?? null,
        ...context,
        provider: checkout.providerData ?? null,
        nextAction: serializeNextAction(checkout.nextAction),
      } as InputJson,
      payment_method_type: checkout.methodType,
      status: checkout.status,
      checkout_url: checkout.checkoutUrl ?? null,
      qr_payload: checkout.qrPayload ?? null,
      response_payload: checkout.responsePayload
        ? (checkout.responsePayload as InputJson)
        : JSON_NULL,
      tenants: { connect: { id: tenant.tenantId } },
      payment_intents: { connect: { id: intent.id } },
      provider_accounts: { connect: { id: providerAccount.id } },
    });
  }

  private async cancelOpenAttempts(intent: IntentWithAttempts) {
    for (const attempt of intent.attempts as payment_attempts[]) {
      if (!isOpenAttemptStatus(attempt.status)) continue;
      const provider = this.providerRegistry.find(attempt.provider_code);
      if (!provider?.cancelCheckout) continue;
      try {
        const providerAccount = attempt.provider_account_id
          ? await this.providerAccounts.byId(attempt.provider_account_id)
          : null;
        await provider.cancelCheckout({
          tenantId: attempt.tenant_id,
          attemptId: attempt.id,
          orderNumber: attempt.order_number,
          providerOrderId: attempt.provider_order_id,
          providerPaymentId: attempt.provider_payment_id,
          providerData: attemptProviderData(attempt),
          providerAccount,
          reason: 'Superseded by a new payment attempt',
        });
      } catch (error) {
        this.logger.warn(
          `cancelCheckout attempt ${attempt.id} failed (ignored): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private toCheckoutError(provider: PaymentProvider, error: unknown) {
    if (error instanceof AppException) return error;
    if (error instanceof ProviderTransportError && error.kind === 'timeout') {
      return new AppException(PaymentErrorCode.GATEWAY_TIMEOUT, {
        message: `Payment gateway "${provider.code}" did not respond in time`,
        details: { reason: 'GATEWAY_TIMEOUT' },
      });
    }
    this.logger.error(
      `createCheckout "${provider.code}" failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new AppException(PaymentErrorCode.GATEWAY_ERROR, {
      message: `Payment gateway "${provider.code}" is experiencing a problem`,
      details: { reason: 'GATEWAY_ERROR' },
    });
  }
}
