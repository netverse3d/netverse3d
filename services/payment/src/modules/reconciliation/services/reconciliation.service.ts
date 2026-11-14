import { Injectable, Logger } from '@nestjs/common';
import {
  InputJson,
  payment_attempts,
  payment_intents,
} from '@app/infrastructure/prisma/prisma.types';
import { AppConfig } from '@app/config/app-config';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentQueryService } from '@app/modules/payments/services/payment-query.service';
import {
  attemptProviderData,
  isOpenAttemptStatus,
} from '@app/modules/payments/views/payment.views';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { ProviderEventRecorder } from '@app/modules/provider-webhooks/services/provider-event-recorder.service';
import {
  PaymentProvider,
  ProviderPaymentState,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { RefundService } from '@app/modules/refunds/services/refund.service';

const BATCH_SIZE = 25;

type ReconcileOutcome = 'unchanged' | 'applied' | 'ignored' | 'duplicate' | 'error';
type ReconcileSource = 'reconciliation' | 'refresh';
type AttemptWithIntent = payment_attempts & { payment_intents: payment_intents };

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly attemptRepository: PaymentAttemptRepository,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly providerAccounts: ProviderAccountResolver,
    private readonly recorder: ProviderEventRecorder,
    private readonly refundService: RefundService,
    private readonly paymentQuery: PaymentQueryService,
    private readonly config: AppConfig,
  ) {}

  async runOnce(limit = BATCH_SIZE) {
    const providerCodes = this.providerRegistry.queryable().map((provider) => provider.code);
    const attempts = await this.attemptRepository.claimForReconciliation({
      providerCodes,
      limit,
      minAgeSeconds: this.config.payment.reconcileMinAgeSeconds,
      spacingSeconds: this.config.payment.reconcileSpacingSeconds,
      maxAgeSeconds: this.config.payment.reconcileMaxAgeHours * 3600,
    });

    const outcomes: Record<ReconcileOutcome, number> = {
      unchanged: 0,
      applied: 0,
      ignored: 0,
      duplicate: 0,
      error: 0,
    };
    for (const attempt of attempts) {
      try {
        outcomes[await this.reconcileAttempt(attempt)] += 1;
      } catch (error) {
        outcomes.error += 1;
        this.logger.error(
          `Reconcile attempt ${attempt.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const expired = await this.expireOverdue(limit);
    const refunds = await this.refundService.reconcilePending();
    return { checked: attempts.length, ...outcomes, expired, refunds };
  }

  async refreshIntent(tenantId: string, publicId: string) {
    const intent = await this.paymentQuery.getIntentRow(tenantId, publicId);
    for (const attempt of intent.attempts) {
      if (!isOpenAttemptStatus(attempt.status)) continue;
      const provider = this.providerRegistry.find(attempt.provider_code);
      if (!provider?.queryPayment || !provider.capabilities().queryPayment) continue;
      const claimed = await this.attemptRepository.claimForRefresh(
        attempt.id,
        this.config.payment.refreshMinIntervalSeconds,
      );
      if (!claimed) continue;
      try {
        await this.reconcileAttempt(claimed, 'refresh');
      } catch (error) {
        this.logger.warn(
          `Refresh attempt ${attempt.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return this.paymentQuery.getIntent(tenantId, publicId);
  }

  async reconcileAttempt(
    attempt: AttemptWithIntent,
    source: ReconcileSource = 'reconciliation',
  ): Promise<ReconcileOutcome> {
    const provider = this.providerRegistry.get(attempt.provider_code);
    if (!provider.queryPayment) return 'unchanged';
    const intent = attempt.payment_intents;
    const providerAccount = attempt.provider_account_id
      ? await this.providerAccounts.byId(attempt.provider_account_id)
      : await this.providerAccounts.activeByTenant(attempt.tenant_id, attempt.provider_code);

    const state = await provider.queryPayment({
      tenantId: attempt.tenant_id,
      publicId: intent.public_id,
      attemptId: attempt.id,
      orderNumber: attempt.order_number,
      providerOrderId: attempt.provider_order_id,
      providerPaymentId: attempt.provider_payment_id,
      providerData: attemptProviderData(attempt),
      amountMinor: intent.total_minor,
      currency: intent.currency,
      attemptCreatedAt: attempt.started_at,
      attemptExpiresAt: attempt.expires_at,
      providerAccount,
      context: { clientIp: this.config.payment.reconciliationServerIp },
    });
    if (!state.status || state.status === attempt.status) return 'unchanged';
    const prefix = source === 'refresh' ? 'refresh' : 'reconcile';
    return this.recordState(
      provider,
      attempt,
      state,
      `${prefix}:${attempt.id}:${state.status}`,
      source,
    );
  }

  async expireOverdue(limit = BATCH_SIZE) {
    const providerCodes = this.providerRegistry.notQueryable().map((provider) => provider.code);
    const attempts = await this.attemptRepository.claimExpired({
      providerCodes,
      graceMinutes: this.config.payment.expiryGraceMinutes,
      spacingSeconds: this.config.payment.reconcileSpacingSeconds,
      limit,
    });
    let applied = 0;
    for (const attempt of attempts) {
      try {
        const provider = this.providerRegistry.get(attempt.provider_code);
        const outcome = await this.recordState(
          provider,
          attempt,
          {
            providerEventId: `expire:${attempt.id}`,
            eventType: 'expiry.expired',
            status: 'expired',
            failureCode: 'EXPIRED',
            failureMessage: 'The payment session has expired',
            payload: {
              expiresAt: attempt.expires_at?.toISOString() ?? null,
              graceMinutes: this.config.payment.expiryGraceMinutes,
            },
          },
          `expire:${attempt.id}`,
          'expiry',
        );
        if (outcome === 'applied') applied += 1;
      } catch (error) {
        this.logger.error(
          `Expire attempt ${attempt.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { checked: attempts.length, applied };
  }

  private async recordState(
    provider: PaymentProvider,
    attempt: AttemptWithIntent,
    state: ProviderPaymentState,
    providerEventId: string,
    source: ReconcileSource | 'expiry',
  ): Promise<ReconcileOutcome> {
    const intent = attempt.payment_intents;
    const eventPrefix =
      source === 'refresh' ? 'refresh' : source === 'expiry' ? 'expiry' : 'reconciliation';
    const result = await this.recorder.record(
      {
        tenant_id: attempt.tenant_id,
        payment_intent_id: intent.id,
        payment_attempt_id: attempt.id,
        provider_code: attempt.provider_code,
        provider_event_id: providerEventId,
        event_type: `${eventPrefix}.${state.status}`,
        signature: null,
        payload_json: state.payload as InputJson,
      },
      {
        status: state.status,
        intentId: intent.id,
        build: (sourceRef) => ({
          providerCode: attempt.provider_code,
          intentId: intent.id,
          attemptId: attempt.id,
          normalized: { ...state, providerEventId },
          requireAmount: provider.capabilities().webhookReportsAmount,
          acceptsLateSuccess: provider.capabilities().acceptsLateSuccess,
          source,
          sourceRef,
        }),
      },
    );
    if (result.kind === 'duplicate') return 'duplicate';
    if (result.kind === 'skipped' || result.kind === 'unmatched') return 'unchanged';
    return result.outcome.kind === 'applied' ? 'applied' : 'ignored';
  }
}
