import { Injectable } from '@nestjs/common';
import {
  InputJson,
  payment_attempt_status,
  payment_attempts,
  payment_intent_status,
} from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';
import { AuditService } from '@app/modules/audit/services/audit.service';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import {
  decideAttemptTransition,
  decideIntentTransition,
  intentStatusForAttemptStatus,
  isLateCaptureCandidate,
  isTerminalAttemptStatus,
} from '@app/modules/payments/state/payment-state-machine';
import { ProviderWebhookNormalization } from '@app/modules/providers/contracts/payment-provider.contract';

const FAILURE_STATUSES: readonly payment_attempt_status[] = ['failed', 'canceled', 'expired'];

export type ProviderEventSource = 'webhook' | 'reconciliation' | 'refresh' | 'expiry' | 'operator';

type IntentRow = NonNullable<Awaited<ReturnType<PaymentIntentRepository['findById']>>>;

export interface ProviderEventInput {
  providerCode: string;
  intentId: string;
  attemptId: string | null;
  normalized: ProviderWebhookNormalization;
  requireAmount: boolean;
  acceptsLateSuccess: boolean;
  source: ProviderEventSource;
  sourceRef: string;
}

export type ProviderEventOutcome =
  | {
      kind: 'applied';
      intent: IntentRow;
      intentChanged: boolean;
      attemptChanged: boolean;
      outboxEventId: bigint | null;
    }
  | { kind: 'ignored'; reason: string; intent: IntentRow };

interface Mismatch {
  code: string;
  details: Record<string, unknown>;
}

@Injectable()
export class ProviderEventProcessorService {
  constructor(
    private readonly intentRepository: PaymentIntentRepository,
    private readonly attemptRepository: PaymentAttemptRepository,
    private readonly outboxRepository: PaymentOutboxRepository,
    private readonly auditService: AuditService,
  ) {}

  async apply(tx: PrismaDb, input: ProviderEventInput): Promise<ProviderEventOutcome> {
    const status = input.normalized.status;
    if (!status) throw new AppException(PaymentErrorCode.PROVIDER_EVENT_STATUS_MISSING);

    await this.intentRepository.lockForUpdate(input.intentId, tx);
    const intent = await this.intentRepository.findById(input.intentId, tx);
    if (!intent) throw new AppException(PaymentErrorCode.PROVIDER_EVENT_TARGET_NOT_FOUND);
    const attempt = input.attemptId
      ? await this.attemptRepository.findById(input.attemptId, tx)
      : null;

    const repeatCapture = await this.applyRepeatCapture(tx, intent, attempt, input);
    if (repeatCapture) return repeatCapture;

    const mismatch =
      this.findReferenceMismatch(intent, attempt, input.normalized) ??
      (status === 'succeeded'
        ? this.findMoneyMismatch(intent, input.normalized, input.requireAmount)
        : null);
    if (mismatch) {
      await this.audit(tx, intent, input, 'payment.provider_event.rejected', {
        reason: mismatch.code,
        ...mismatch.details,
      });
      return { kind: 'ignored', reason: mismatch.code, intent };
    }

    let attemptDecision = attempt ? decideAttemptTransition(attempt.status, status) : 'noop';
    let lateCapture = false;
    if (attempt && attemptDecision === 'reject') {
      if (input.acceptsLateSuccess && isLateCaptureCandidate(attempt.status, status)) {
        attemptDecision = 'apply';
        lateCapture = true;
      } else {
        if (status === 'succeeded') {
          await this.audit(tx, intent, input, 'payment.provider_event.late_success_rejected', {
            attemptId: attempt.id,
            attemptStatus: attempt.status,
          });
        }
        return { kind: 'ignored', reason: 'STALE_ATTEMPT_TRANSITION', intent };
      }
    }

    const failure = FAILURE_STATUSES.includes(status);
    const superseded = Boolean(
      attempt && failure && (await this.attemptRepository.hasNewerAttempt(attempt, tx)),
    );
    const nextIntentStatus = intentStatusForAttemptStatus(status);
    const intentDecision = superseded
      ? 'noop'
      : decideIntentTransition(intent.status, nextIntentStatus);
    const attemptChanged = attemptDecision === 'apply';
    const intentChanged = intentDecision === 'apply';
    if (!attemptChanged && !intentChanged) {
      const reason = superseded
        ? 'SUPERSEDED_ATTEMPT'
        : intentDecision === 'reject'
          ? 'STALE_INTENT_TRANSITION'
          : 'NO_STATE_CHANGE';
      return { kind: 'ignored', reason, intent };
    }

    if (attempt && attemptChanged) {
      const capturedPaymentId = status === 'succeeded' ? input.normalized.providerPaymentId : null;
      await this.attemptRepository.update(
        attempt.id,
        {
          status,
          response_payload: input.normalized.payload as InputJson,
          completed_at: isTerminalAttemptStatus(status) ? new Date() : undefined,
          provider_payment_id: attempt.provider_payment_id ?? capturedPaymentId ?? undefined,
          failure_code: failure ? (input.normalized.failureCode ?? null) : undefined,
          failure_message: failure ? (input.normalized.failureMessage ?? null) : undefined,
        },
        tx,
      );
      if (lateCapture && intentChanged) {
        await this.audit(tx, intent, input, 'payment.provider_event.late_success_accepted', {
          attemptId: attempt.id,
          attemptStatus: attempt.status,
          intentStatus: intent.status,
        });
      }
      if (status === 'succeeded' && !intentChanged) {
        await this.audit(tx, intent, input, 'payment.provider_event.extra_capture', {
          attemptId: attempt.id,
          attemptStatus: attempt.status,
          intentStatus: intent.status,
        });
        const extraCapture = await this.enqueue(
          tx,
          intent,
          'payment.extra_capture',
          input,
          attempt,
          false,
        );
        return {
          kind: 'applied',
          intent,
          intentChanged: false,
          attemptChanged,
          outboxEventId: extraCapture.id,
        };
      }
    }

    if (!intentChanged) {
      return { kind: 'applied', intent, intentChanged: false, attemptChanged, outboxEventId: null };
    }

    const now = new Date();
    const updatedIntent = await this.intentRepository.update(
      intent.id,
      {
        status: nextIntentStatus,
        paid_at: nextIntentStatus === 'succeeded' ? now : undefined,
        failed_at: nextIntentStatus === 'failed' ? now : undefined,
        canceled_at: nextIntentStatus === 'canceled' ? now : undefined,
        expired_at: nextIntentStatus === 'expired' ? now : undefined,
      },
      tx,
    );

    const outboxEvent = await this.enqueue(
      tx,
      updatedIntent,
      this.outboxEventType(nextIntentStatus),
      input,
      attempt,
      failure,
    );
    return {
      kind: 'applied',
      intent: updatedIntent,
      intentChanged: true,
      attemptChanged,
      outboxEventId: outboxEvent.id,
    };
  }

  private async applyRepeatCapture(
    tx: PrismaDb,
    intent: IntentRow,
    attempt: payment_attempts | null,
    input: ProviderEventInput,
  ): Promise<ProviderEventOutcome | null> {
    const providerPaymentId = input.normalized.providerPaymentId;
    if (
      !attempt ||
      input.source === 'operator' ||
      input.normalized.status !== 'succeeded' ||
      attempt.status !== 'succeeded' ||
      !providerPaymentId ||
      !attempt.provider_payment_id ||
      providerPaymentId === attempt.provider_payment_id
    ) {
      return null;
    }
    if (
      this.findReferenceMismatch(
        intent,
        { ...attempt, provider_payment_id: null },
        input.normalized,
      )
    )
      return null;
    if (this.findMoneyMismatch(intent, input.normalized, input.requireAmount)) return null;
    await this.audit(tx, intent, input, 'payment.provider_event.extra_capture', {
      attemptId: attempt.id,
      attemptStatus: attempt.status,
      intentStatus: intent.status,
      capturedProviderPaymentId: attempt.provider_payment_id,
      repeatProviderPaymentId: providerPaymentId,
    });
    const event = await this.enqueue(tx, intent, 'payment.extra_capture', input, attempt, false);
    return {
      kind: 'applied',
      intent,
      intentChanged: false,
      attemptChanged: false,
      outboxEventId: event.id,
    };
  }

  private enqueue(
    tx: PrismaDb,
    intent: IntentRow,
    eventType: string,
    input: ProviderEventInput,
    attempt: payment_attempts | null,
    failure: boolean,
  ) {
    return this.outboxRepository.create(
      {
        aggregate_type: 'payment_intent',
        aggregate_id: intent.id,
        event_type: eventType,
        payload_json: {
          paymentIntentId: intent.id,
          publicId: intent.public_id,
          merchantReference: intent.merchant_reference,
          targetType: intent.target_type,
          targetRef: intent.target_ref,
          status: intent.status,
          currency: intent.currency,
          totalMinor: intent.total_minor.toString(),
          providerCode: input.providerCode,
          providerPaymentId:
            input.normalized.providerPaymentId ?? attempt?.provider_payment_id ?? null,
          attemptId: attempt?.id ?? null,
          orderNumber: attempt?.order_number?.toString() ?? null,
          failureCode: failure ? (input.normalized.failureCode ?? null) : null,
          failureMessage: failure ? (input.normalized.failureMessage ?? null) : null,
        } as InputJson,
        tenants: { connect: { id: intent.tenant_id } },
        payment_intents: { connect: { id: intent.id } },
      },
      tx,
    );
  }

  private findReferenceMismatch(
    intent: IntentRow,
    attempt: payment_attempts | null,
    normalized: ProviderWebhookNormalization,
  ): Mismatch | null {
    if (attempt && attempt.payment_intent_id !== intent.id) {
      return {
        code: 'ATTEMPT_INTENT_MISMATCH',
        details: { attemptId: attempt.id, intentId: intent.id },
      };
    }
    if (normalized.paymentIntentPublicId && normalized.paymentIntentPublicId !== intent.public_id) {
      return {
        code: 'INTENT_REFERENCE_MISMATCH',
        details: { expected: intent.public_id, received: normalized.paymentIntentPublicId },
      };
    }
    if (
      normalized.providerOrderId &&
      attempt?.provider_order_id &&
      normalized.providerOrderId !== attempt.provider_order_id
    ) {
      return {
        code: 'PROVIDER_ORDER_MISMATCH',
        details: { expected: attempt.provider_order_id, received: normalized.providerOrderId },
      };
    }
    if (
      normalized.providerPaymentId &&
      attempt?.provider_payment_id &&
      normalized.providerPaymentId !== attempt.provider_payment_id
    ) {
      return {
        code: 'PROVIDER_PAYMENT_MISMATCH',
        details: { expected: attempt.provider_payment_id, received: normalized.providerPaymentId },
      };
    }
    return null;
  }

  private findMoneyMismatch(
    intent: IntentRow,
    normalized: ProviderWebhookNormalization,
    requireAmount: boolean,
  ): Mismatch | null {
    const amount = normalized.amountMinor ?? null;
    const currency = normalized.currency ?? null;
    if (requireAmount && (amount === null || currency === null)) {
      return {
        code: 'AMOUNT_MISSING',
        details: { amountMinor: amount?.toString() ?? null, currency },
      };
    }
    if (amount !== null && amount !== intent.total_minor) {
      return {
        code: 'AMOUNT_MISMATCH',
        details: { expected: intent.total_minor.toString(), received: amount.toString() },
      };
    }
    if (currency !== null && currency.toUpperCase() !== intent.currency.toUpperCase()) {
      return {
        code: 'CURRENCY_MISMATCH',
        details: { expected: intent.currency, received: currency },
      };
    }
    return null;
  }

  private outboxEventType(status: payment_intent_status) {
    return `payment.${status}`;
  }

  private audit(
    tx: PrismaDb,
    intent: IntentRow,
    input: ProviderEventInput,
    action: string,
    details: Record<string, unknown>,
  ) {
    return this.auditService.record(
      {
        action,
        resourceType: 'payment_intent',
        resourceId: intent.id,
        outcome: 'SUCCESS',
        tenantId: intent.tenant_id,
        actorSubject: input.providerCode,
        metadata: {
          actorType: 'provider',
          source: input.source,
          sourceRef: input.sourceRef,
          providerEventId: input.normalized.providerEventId,
          eventStatus: input.normalized.status ?? null,
          ...details,
        },
      },
      tx,
    );
  }
}
