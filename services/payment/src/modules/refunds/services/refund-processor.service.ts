import { Injectable } from '@nestjs/common';
import { InputJson, payment_intent_status, refunds } from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';
import { AuditService } from '@app/modules/audit/services/audit.service';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { decideIntentTransition } from '@app/modules/payments/state/payment-state-machine';
import { ProviderRefundState } from '@app/modules/providers/contracts/payment-provider.contract';
import { RefundRepository } from '../repositories/refund.repository';
import { decideRefundTransition } from '../state/refund-state-machine';

type IntentRow = NonNullable<Awaited<ReturnType<PaymentIntentRepository['findById']>>>;

export interface RefundStateInput {
  refundId: string;
  state: ProviderRefundState;
  source: 'create' | 'reconciliation';
  providerCode: string;
}

export type RefundOutcome =
  | {
      kind: 'applied';
      refund: refunds;
      intentStatus: payment_intent_status;
      outboxEventIds: bigint[];
    }
  | { kind: 'ignored'; reason: string; refund: refunds };

@Injectable()
export class RefundProcessorService {
  constructor(
    private readonly refundRepository: RefundRepository,
    private readonly intentRepository: PaymentIntentRepository,
    private readonly outboxRepository: PaymentOutboxRepository,
    private readonly auditService: AuditService,
  ) {}

  async apply(tx: PrismaDb, input: RefundStateInput): Promise<RefundOutcome> {
    const initial = await this.refundRepository.findById(input.refundId, tx);
    if (!initial) throw new AppException(PaymentErrorCode.REFUND_NOT_FOUND);
    await this.intentRepository.lockForUpdate(initial.payment_intent_id, tx);
    await this.refundRepository.lockForUpdate(initial.id, tx);
    const refund = (await this.refundRepository.findById(initial.id, tx))!;
    const intent = (await this.intentRepository.findById(refund.payment_intent_id, tx))!;

    const decision = decideRefundTransition(refund.status, input.state.status);
    if (decision !== 'apply') {
      return {
        kind: 'ignored',
        reason: decision === 'noop' ? 'NO_STATE_CHANGE' : 'STALE_REFUND_TRANSITION',
        refund,
      };
    }

    const now = new Date();
    const updated = await this.refundRepository.update(
      refund.id,
      {
        status: input.state.status,
        provider_refund_id: refund.provider_refund_id ?? input.state.providerRefundId ?? null,
        response_payload: input.state.payload as InputJson,
        completed_at: input.state.status === 'succeeded' ? now : undefined,
        failed_at: input.state.status === 'failed' ? now : undefined,
        failure_reason:
          input.state.status === 'failed'
            ? (input.state.failureReason ?? 'Provider rejected refund')
            : undefined,
      },
      tx,
    );

    const outboxEventIds: bigint[] = [];
    let intentStatus = intent.status;
    if (input.state.status === 'processing' || input.state.status === 'failed') {
      const eventType =
        input.state.status === 'processing' ? 'payment.refund.processing' : 'payment.refund.failed';
      outboxEventIds.push(
        await this.enqueue(tx, 'refund', updated.id, eventType, intent, updated, intent.status),
      );
    }

    if (input.state.status === 'succeeded') {
      const refundedTotal = await this.refundRepository.sumSucceeded(intent.id, tx);
      const target: payment_intent_status =
        refundedTotal >= intent.total_minor ? 'refunded' : 'partially_refunded';
      const intentDecision = decideIntentTransition(intent.status, target);
      if (intentDecision === 'apply') {
        const updatedIntent = await this.intentRepository.update(intent.id, { status: target }, tx);
        intentStatus = updatedIntent.status;
        outboxEventIds.push(
          await this.enqueue(
            tx,
            'payment_intent',
            intent.id,
            `payment.${target}`,
            updatedIntent,
            updated,
            target,
            refundedTotal,
          ),
        );
      } else if (intentDecision === 'noop' && target === 'partially_refunded') {
        outboxEventIds.push(
          await this.enqueue(
            tx,
            'payment_intent',
            intent.id,
            'payment.partially_refunded',
            intent,
            updated,
            target,
            refundedTotal,
          ),
        );
      } else if (intentDecision === 'reject') {
        await this.auditService.record(
          {
            action: 'payment.refund.intent_transition_rejected',
            resourceType: 'refund',
            resourceId: updated.id,
            outcome: 'SUCCESS',
            tenantId: intent.tenant_id,
            actorSubject: input.providerCode,
            metadata: {
              actorType: 'provider',
              intentStatus: intent.status,
              target,
              refundedTotalMinor: refundedTotal.toString(),
              source: input.source,
            },
          },
          tx,
        );
      }
    }

    return { kind: 'applied', refund: updated, intentStatus, outboxEventIds };
  }

  private async enqueue(
    tx: PrismaDb,
    aggregateType: 'refund' | 'payment_intent',
    aggregateId: string,
    eventType: string,
    intent: IntentRow,
    refund: refunds,
    intentStatus: payment_intent_status,
    refundedTotal?: bigint,
  ) {
    const event = await this.outboxRepository.create(
      {
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        event_type: eventType,
        payload_json: {
          paymentIntentId: intent.id,
          publicId: intent.public_id,
          status: intentStatus,
          merchantReference: intent.merchant_reference,
          targetType: intent.target_type,
          targetRef: intent.target_ref,
          currency: intent.currency,
          totalMinor: intent.total_minor.toString(),
          refundId: refund.id,
          refundPublicId: refund.public_id,
          refundStatus: refund.status,
          refundAmountMinor: refund.amount_minor.toString(),
          refundedTotalMinor: refundedTotal?.toString() ?? null,
        } as InputJson,
        tenants: { connect: { id: intent.tenant_id } },
        payment_intents: { connect: { id: intent.id } },
      },
      tx,
    );
    return event.id;
  }
}
