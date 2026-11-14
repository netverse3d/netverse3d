import { Injectable } from '@nestjs/common';
import { InputJson } from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { AuditService } from '@app/modules/audit/services/audit.service';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentQueryService } from '@app/modules/payments/services/payment-query.service';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { bankTransferPaymentId } from '@app/modules/providers/shared/bank-transfer.util';
import { ConfirmTransferDto } from '../dto/confirm-transfer.dto';
import { ProviderEventRecorder } from './provider-event-recorder.service';

const NOT_CONFIRMABLE = 'TRANSFER_NOT_CONFIRMABLE';

@Injectable()
export class OperatorConfirmService {
  constructor(
    private readonly attemptRepository: PaymentAttemptRepository,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly recorder: ProviderEventRecorder,
    private readonly auditService: AuditService,
    private readonly paymentQuery: PaymentQueryService,
  ) {}

  async confirmTransfer(tenantId: string, attemptId: string, dto: ConfirmTransferDto) {
    const attempt = await this.attemptRepository.findByIdForTenant(tenantId, attemptId);
    if (!attempt) throw new AppException(PaymentErrorCode.PAYMENT_ATTEMPT_NOT_FOUND);
    const provider = this.providerRegistry.find(attempt.provider_code);
    if (!provider?.capabilities().operatorConfirm) {
      throw new AppException(PaymentErrorCode.TRANSFER_NOT_CONFIRMABLE, {
        details: { reason: NOT_CONFIRMABLE },
      });
    }
    if (attempt.status === 'succeeded') {
      throw new AppException(PaymentErrorCode.TRANSFER_NOT_CONFIRMABLE, {
        message: 'This payment has already been recorded as paid',
        details: { reason: NOT_CONFIRMABLE },
      });
    }
    const intent = attempt.payment_intents;
    const amountMinor = BigInt(dto.amountMinor);
    const currency = dto.currency.toUpperCase();
    if (amountMinor !== intent.total_minor || currency !== intent.currency.toUpperCase()) {
      throw new AppException(PaymentErrorCode.TRANSFER_AMOUNT_MISMATCH, {
        details: {
          reason: 'AMOUNT_MISMATCH',
          expectedMinor: intent.total_minor.toString(),
          receivedMinor: amountMinor.toString(),
          expectedCurrency: intent.currency,
        },
      });
    }

    const providerPaymentId = bankTransferPaymentId(dto.bankReference);
    const holder = await this.attemptRepository.findByProviderPaymentId(
      attempt.provider_code,
      providerPaymentId,
    );
    if (holder && holder.id !== attempt.id) {
      throw new AppException(PaymentErrorCode.BANK_REFERENCE_USED, {
        details: { reason: 'BANK_REFERENCE_USED' },
      });
    }

    const providerEventId = `operator:${attempt.id}:${dto.bankReference}`;
    const payload = {
      amountMinor: amountMinor.toString(),
      currency,
      bankReference: dto.bankReference,
      operatorRef: dto.operatorRef,
    };
    const result = await this.recorder.record(
      {
        tenant_id: tenantId,
        payment_intent_id: intent.id,
        payment_attempt_id: attempt.id,
        provider_code: attempt.provider_code,
        provider_event_id: providerEventId,
        event_type: 'operator.confirm_transfer',
        signature: null,
        payload_json: payload as InputJson,
      },
      {
        status: 'succeeded',
        intentId: intent.id,
        build: (sourceRef) => ({
          providerCode: attempt.provider_code,
          intentId: intent.id,
          attemptId: attempt.id,
          normalized: {
            providerEventId,
            eventType: 'operator.confirm_transfer',
            status: 'succeeded',
            amountMinor,
            currency,
            providerPaymentId,
            payload,
          },
          requireAmount: true,
          acceptsLateSuccess: provider.capabilities().acceptsLateSuccess,
          source: 'operator',
          sourceRef,
        }),
        onApplied: async (tx) => {
          await this.auditService.record(
            {
              action: 'payment.operator.transfer_confirmed',
              resourceType: 'payment_attempt',
              resourceId: attempt.id,
              outcome: 'SUCCESS',
              tenantId,
              actorSubject: dto.operatorRef,
              metadata: { actorType: 'operator', ...payload },
            },
            tx,
          );
        },
      },
    );
    if (result.kind === 'done' && result.outcome.kind === 'ignored') {
      throw new AppException(PaymentErrorCode.TRANSFER_NOT_CONFIRMABLE, {
        message: 'The transfer confirmation could not be recorded',
        details: { reason: NOT_CONFIRMABLE, cause: result.outcome.reason },
      });
    }
    return this.paymentQuery.getIntent(tenantId, intent.public_id);
  }
}
