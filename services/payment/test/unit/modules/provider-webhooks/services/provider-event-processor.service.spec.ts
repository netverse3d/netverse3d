import {
  payment_attempt_status,
  payment_intent_status,
} from '@app/infrastructure/prisma/prisma.types';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';
import { AuditService } from '@app/modules/audit/services/audit.service';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { ProviderWebhookNormalization } from '@app/modules/providers/contracts/payment-provider.contract';
import {
  ProviderEventInput,
  ProviderEventProcessorService,
} from '@app/modules/provider-webhooks/services/provider-event-processor.service';

const TX = { tx: true } as unknown as PrismaDb;

function intentRow(status: payment_intent_status, overrides: Record<string, unknown> = {}) {
  return {
    id: 'intent-1',
    tenant_id: 'tenant-1',
    public_id: 'pi_pub_1',
    merchant_reference: 'merchant:subscription:s1',
    target_type: 'user_subscription',
    target_ref: 'user-1',
    status,
    currency: 'VND',
    total_minor: 49000n,
    ...overrides,
  };
}

function attemptRow(status: payment_attempt_status, overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    payment_intent_id: 'intent-1',
    status,
    provider_payment_id: 'fake_pi_pub_1',
    provider_order_id: 'pi_pub_1',
    ...overrides,
  };
}

function setup(
  intentStatus: payment_intent_status,
  attemptStatus: payment_attempt_status | null,
  attemptOverrides = {},
) {
  const intentRepo = {
    lockForUpdate: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(intentRow(intentStatus)),
    update: jest
      .fn()
      .mockImplementation((_id: string, data: { status: payment_intent_status }) =>
        Promise.resolve(intentRow(data.status)),
      ),
  };
  const attemptRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(attemptStatus ? attemptRow(attemptStatus, attemptOverrides) : null),
    update: jest.fn().mockResolvedValue({}),
    hasNewerAttempt: jest.fn().mockResolvedValue(false),
  };
  const outboxRepo = { create: jest.fn().mockResolvedValue({ id: 77n }) };
  const auditRepo = { record: jest.fn().mockResolvedValue(undefined) };
  const processor = new ProviderEventProcessorService(
    intentRepo as unknown as PaymentIntentRepository,
    attemptRepo as unknown as PaymentAttemptRepository,
    outboxRepo as unknown as PaymentOutboxRepository,
    auditRepo as unknown as AuditService,
  );
  return { processor, intentRepo, attemptRepo, outboxRepo, auditRepo };
}

function input(
  normalized: Partial<ProviderWebhookNormalization>,
  overrides: Partial<ProviderEventInput> = {},
): ProviderEventInput {
  return {
    providerCode: 'fake',
    intentId: 'intent-1',
    attemptId: 'attempt-1',
    normalized: {
      providerEventId: 'evt_1',
      eventType: 'payment.succeeded',
      providerPaymentId: 'fake_pi_pub_1',
      paymentIntentPublicId: 'pi_pub_1',
      status: 'succeeded',
      payload: {},
      ...normalized,
    },
    requireAmount: false,
    acceptsLateSuccess: false,
    source: 'webhook',
    sourceRef: 'wh-1',
    ...overrides,
  };
}

describe('ProviderEventProcessorService.apply', () => {
  it('khoá intent TRƯỚC khi đọc trạng thái trong cùng transaction', async () => {
    const { processor, intentRepo } = setup('pending', 'requires_action');
    await processor.apply(TX, input({}));
    expect(intentRepo.lockForUpdate).toHaveBeenCalledWith('intent-1', TX);
    expect(intentRepo.lockForUpdate.mock.invocationCallOrder[0]!).toBeLessThan(
      intentRepo.findById.mock.invocationCallOrder[0]!,
    );
    expect(intentRepo.findById).toHaveBeenCalledWith('intent-1', TX);
  });

  it('succeeded hợp lệ -> cập nhật attempt + intent + outbox trong cùng tx', async () => {
    const { processor, attemptRepo, intentRepo, outboxRepo } = setup('pending', 'requires_action');
    const outcome = await processor.apply(TX, input({ amountMinor: 49000n, currency: 'vnd' }));

    expect(outcome).toMatchObject({
      kind: 'applied',
      intentChanged: true,
      attemptChanged: true,
      outboxEventId: 77n,
    });
    expect(attemptRepo.update).toHaveBeenCalledWith(
      'attempt-1',
      expect.objectContaining({ status: 'succeeded' }),
      TX,
    );
    expect(intentRepo.update).toHaveBeenCalledWith(
      'intent-1',
      expect.objectContaining({ status: 'succeeded', paid_at: expect.any(Date) }),
      TX,
    );
    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'payment.succeeded',
        payload_json: expect.objectContaining({
          publicId: 'pi_pub_1',
          status: 'succeeded',
          totalMinor: '49000',
        }),
      }),
      TX,
    );
  });

  it('event failed đến muộn sau khi đã succeeded -> ignored, KHÔNG ghi gì', async () => {
    const { processor, attemptRepo, intentRepo, outboxRepo } = setup('succeeded', 'succeeded');
    const outcome = await processor.apply(TX, input({ status: 'failed' }));

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'STALE_ATTEMPT_TRANSITION' });
    expect(attemptRepo.update).not.toHaveBeenCalled();
    expect(intentRepo.update).not.toHaveBeenCalled();
    expect(outboxRepo.create).not.toHaveBeenCalled();
  });

  it('event failed của intent không có attempt, intent đã succeeded -> ignored', async () => {
    const { processor, intentRepo, outboxRepo } = setup('succeeded', null);
    const outcome = await processor.apply(TX, input({ status: 'failed' }, { attemptId: null }));

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'STALE_INTENT_TRANSITION' });
    expect(intentRepo.update).not.toHaveBeenCalled();
    expect(outboxRepo.create).not.toHaveBeenCalled();
  });

  it('succeeded lặp lại (event-id khác) -> ignored NO_STATE_CHANGE, không outbox lần hai', async () => {
    const { processor, outboxRepo } = setup('succeeded', 'succeeded');
    const outcome = await processor.apply(TX, input({ status: 'succeeded' }));

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'NO_STATE_CHANGE' });
    expect(outboxRepo.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ amountMinor: 1000n, currency: 'VND' }, 'AMOUNT_MISMATCH'],
    [{ amountMinor: 49000n, currency: 'USD' }, 'CURRENCY_MISMATCH'],
  ])('số tiền/tiền tệ lệch %p -> ignored %s + audit, KHÔNG succeeded', async (money, reason) => {
    const { processor, intentRepo, attemptRepo, outboxRepo, auditRepo } = setup(
      'pending',
      'requires_action',
    );
    const outcome = await processor.apply(TX, input(money));

    expect(outcome).toMatchObject({ kind: 'ignored', reason });
    expect(intentRepo.update).not.toHaveBeenCalled();
    expect(attemptRepo.update).not.toHaveBeenCalled();
    expect(outboxRepo.create).not.toHaveBeenCalled();
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.provider_event.rejected',
        metadata: expect.objectContaining({ reason }),
      }),
      TX,
    );
  });

  it('provider bắt buộc số tiền mà event thiếu -> AMOUNT_MISSING', async () => {
    const { processor, intentRepo } = setup('pending', 'requires_action');
    const outcome = await processor.apply(TX, input({}, { requireAmount: true }));

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'AMOUNT_MISSING' });
    expect(intentRepo.update).not.toHaveBeenCalled();
  });

  it('provider không bắt buộc số tiền (fake) + event không gửi số tiền -> vẫn succeeded', async () => {
    const { processor } = setup('pending', 'requires_action');
    await expect(processor.apply(TX, input({}))).resolves.toMatchObject({
      kind: 'applied',
      intentChanged: true,
    });
  });

  it('chỉ đối chiếu số tiền trước succeeded — event failed không bị chặn vì thiếu số tiền', async () => {
    const { processor } = setup('pending', 'requires_action');
    await expect(
      processor.apply(TX, input({ status: 'failed' }, { requireAmount: true })),
    ).resolves.toMatchObject({
      kind: 'applied',
    });
  });

  it.each([
    [{ paymentIntentPublicId: 'pi_other' }, {}, 'INTENT_REFERENCE_MISMATCH'],
    [{ providerOrderId: 'order_other' }, {}, 'PROVIDER_ORDER_MISMATCH'],
    [{ providerPaymentId: 'fake_other' }, {}, 'PROVIDER_PAYMENT_MISMATCH'],
    [{}, { payment_intent_id: 'intent-2' }, 'ATTEMPT_INTENT_MISMATCH'],
  ])('reference lệch %p -> ignored %s', async (normalized, attemptOverrides, reason) => {
    const { processor, intentRepo } = setup('pending', 'requires_action', attemptOverrides);
    const outcome = await processor.apply(TX, input(normalized));

    expect(outcome).toMatchObject({ kind: 'ignored', reason });
    expect(intentRepo.update).not.toHaveBeenCalled();
  });

  it('attempt chưa có provider_payment_id -> điền từ event (kiểu VNPAY vnp_TransactionNo)', async () => {
    const { processor, attemptRepo } = setup('pending', 'requires_action', {
      provider_payment_id: null,
    });
    await processor.apply(TX, input({ providerPaymentId: '14123456' }));

    expect(attemptRepo.update).toHaveBeenCalledWith(
      'attempt-1',
      expect.objectContaining({ provider_payment_id: '14123456' }),
      TX,
    );
  });

  it('attempt thứ hai thành công trên intent đã succeeded -> ghi attempt + audit extra_capture + outbox payment.extra_capture', async () => {
    const { processor, attemptRepo, outboxRepo, auditRepo, intentRepo } = setup(
      'succeeded',
      'requires_action',
      { id: 'attempt-2' },
    );
    const outcome = await processor.apply(TX, input({}, { attemptId: 'attempt-2' }));

    expect(outcome).toMatchObject({
      kind: 'applied',
      intentChanged: false,
      attemptChanged: true,
      outboxEventId: 77n,
    });
    expect(attemptRepo.update).toHaveBeenCalled();
    expect(intentRepo.update).not.toHaveBeenCalled();
    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'payment.extra_capture',
        payload_json: expect.objectContaining({ status: 'succeeded', attemptId: 'attempt-2' }),
      }),
      TX,
    );
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.provider_event.extra_capture' }),
      TX,
    );
  });

  it('late success cho attempt đã failed -> ignored + audit late_success_rejected', async () => {
    const { processor, auditRepo, intentRepo } = setup('failed', 'failed');
    const outcome = await processor.apply(TX, input({ status: 'succeeded' }));

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'STALE_ATTEMPT_TRANSITION' });
    expect(intentRepo.update).not.toHaveBeenCalled();
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.provider_event.late_success_rejected' }),
      TX,
    );
  });

  it('lỗi khi ghi outbox -> ném lỗi ra ngoài để caller rollback cả transaction', async () => {
    const { processor, outboxRepo } = setup('pending', 'requires_action');
    outboxRepo.create.mockRejectedValueOnce(new Error('outbox insert failed'));

    await expect(processor.apply(TX, input({}))).rejects.toThrow('outbox insert failed');
  });
});

describe('ProviderEventProcessorService.apply — tiền về muộn (D4) + mã lỗi', () => {
  it.each(['expired', 'failed', 'canceled'] as const)(
    'attempt %s + intent chưa thu + thành công đúng tiền -> attempt & intent succeeded, outbox payment.succeeded',
    async (closed) => {
      const { processor, attemptRepo, intentRepo, outboxRepo, auditRepo } = setup(closed, closed);
      const outcome = await processor.apply(
        TX,
        input(
          { amountMinor: 49000n, currency: 'VND' },
          { acceptsLateSuccess: true, requireAmount: true },
        ),
      );

      expect(outcome).toMatchObject({
        kind: 'applied',
        intentChanged: true,
        attemptChanged: true,
        outboxEventId: 77n,
      });
      expect(attemptRepo.update).toHaveBeenCalledWith(
        'attempt-1',
        expect.objectContaining({ status: 'succeeded' }),
        TX,
      );
      expect(intentRepo.update).toHaveBeenCalledWith(
        'intent-1',
        expect.objectContaining({ status: 'succeeded' }),
        TX,
      );
      expect(outboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'payment.succeeded' }),
        TX,
      );
      expect(auditRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'payment.provider_event.late_success_accepted' }),
        TX,
      );
    },
  );

  it('tiền về muộn nhưng LỆCH số tiền -> ignored AMOUNT_MISMATCH, không chạm attempt', async () => {
    const { processor, attemptRepo, intentRepo } = setup('expired', 'expired');
    const outcome = await processor.apply(
      TX,
      input(
        { amountMinor: 1000n, currency: 'VND' },
        { acceptsLateSuccess: true, requireAmount: true },
      ),
    );

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'AMOUNT_MISMATCH' });
    expect(attemptRepo.update).not.toHaveBeenCalled();
    expect(intentRepo.update).not.toHaveBeenCalled();
  });

  it('attempt expired nhưng intent ĐÃ thu bằng attempt khác -> attempt succeeded + extra_capture, intent giữ nguyên', async () => {
    const { processor, attemptRepo, intentRepo, outboxRepo } = setup('succeeded', 'expired', {
      id: 'attempt-2',
    });
    const outcome = await processor.apply(
      TX,
      input({}, { attemptId: 'attempt-2', acceptsLateSuccess: true }),
    );

    expect(outcome).toMatchObject({ kind: 'applied', intentChanged: false, attemptChanged: true });
    expect(attemptRepo.update).toHaveBeenCalledWith(
      'attempt-2',
      expect.objectContaining({ status: 'succeeded' }),
      TX,
    );
    expect(intentRepo.update).not.toHaveBeenCalled();
    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'payment.extra_capture' }),
      TX,
    );
  });

  it('failed đến muộn sau succeeded KHÔNG hạ cấp dù acceptsLateSuccess bật (G-PAY-07)', async () => {
    const { processor, attemptRepo, intentRepo } = setup('succeeded', 'succeeded');
    const outcome = await processor.apply(
      TX,
      input({ status: 'failed' }, { acceptsLateSuccess: true }),
    );

    expect(outcome).toMatchObject({ kind: 'ignored', reason: 'STALE_ATTEMPT_TRANSITION' });
    expect(attemptRepo.update).not.toHaveBeenCalled();
    expect(intentRepo.update).not.toHaveBeenCalled();
  });

  it('failed -> ghi failure_code/failure_message vào attempt và outbox payload (thêm attemptId, orderNumber)', async () => {
    const { processor, attemptRepo, outboxRepo } = setup('requires_action', 'requires_action', {
      order_number: 42n,
    });
    await processor.apply(
      TX,
      input({
        status: 'failed',
        failureCode: '51',
        failureMessage: 'The account has insufficient funds',
      }),
    );

    expect(attemptRepo.update).toHaveBeenCalledWith(
      'attempt-1',
      expect.objectContaining({
        status: 'failed',
        failure_code: '51',
        failure_message: 'The account has insufficient funds',
      }),
      TX,
    );
    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'payment.failed',
        payload_json: expect.objectContaining({
          failureCode: '51',
          failureMessage: 'The account has insufficient funds',
          attemptId: 'attempt-1',
          orderNumber: '42',
        }),
      }),
      TX,
    );
  });

  it('succeeded -> payload outbox có failureCode null', async () => {
    const { processor, outboxRepo } = setup('pending', 'requires_action');
    await processor.apply(TX, input({ failureCode: '99' }));

    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payload_json: expect.objectContaining({ failureCode: null, failureMessage: null }),
      }),
      TX,
    );
  });

  it('attempt cũ bị huỷ/hết hạn khi intent đã có attempt mới hơn -> chỉ đóng attempt, intent giữ nguyên, không outbox', async () => {
    for (const status of ['canceled', 'expired', 'failed'] as const) {
      const { processor, attemptRepo, intentRepo, outboxRepo } = setup(
        'requires_action',
        'requires_action',
      );
      attemptRepo.hasNewerAttempt.mockResolvedValue(true);
      const outcome = await processor.apply(TX, input({ status }));

      expect(outcome).toMatchObject({
        kind: 'applied',
        intentChanged: false,
        attemptChanged: true,
        outboxEventId: null,
      });
      expect(attemptRepo.update).toHaveBeenCalledWith(
        'attempt-1',
        expect.objectContaining({ status }),
        TX,
      );
      expect(intentRepo.update).not.toHaveBeenCalled();
      expect(outboxRepo.create).not.toHaveBeenCalled();
    }
  });

  it('attempt cũ đã đóng + intent có attempt mới hơn -> ignored SUPERSEDED_ATTEMPT', async () => {
    const { processor, attemptRepo, intentRepo } = setup('requires_action', 'canceled');
    attemptRepo.hasNewerAttempt.mockResolvedValue(true);
    await expect(processor.apply(TX, input({ status: 'canceled' }))).resolves.toMatchObject({
      kind: 'ignored',
      reason: 'SUPERSEDED_ATTEMPT',
    });
    expect(intentRepo.update).not.toHaveBeenCalled();
  });

  it('event thất bại mang mã giao dịch -> KHÔNG lưu provider_payment_id, tiền về sau với mã khác vẫn được ghi nhận', async () => {
    const { processor, attemptRepo } = setup('requires_action', 'requires_action', {
      provider_payment_id: null,
    });
    await processor.apply(
      TX,
      input({ status: 'failed', providerPaymentId: '14000001', failureCode: '51' }),
    );

    const data = attemptRepo.update.mock.calls[0][1] as { provider_payment_id?: string };
    expect(data.provider_payment_id).toBeUndefined();
  });

  it('người vận hành xác nhận attempt đã succeeded với mã ngân hàng khác -> ignored, KHÔNG extra_capture', async () => {
    const { processor, outboxRepo, auditRepo } = setup('succeeded', 'succeeded', {
      provider_payment_id: 'bank:FT1',
    });
    const outcome = await processor.apply(
      TX,
      input({ providerPaymentId: 'bank:FT2' }, { source: 'operator' }),
    );

    expect(outcome).toMatchObject({ kind: 'ignored' });
    expect(outboxRepo.create).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.provider_event.extra_capture' }),
      TX,
    );
  });
});
