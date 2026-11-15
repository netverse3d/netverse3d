import { idempotency_records } from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { sha256 } from '@app/modules/shared/utils/hash.util';
import { IdempotencyRepository } from '@app/modules/idempotency/repositories/idempotency.repository';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';

const CONTEXT = {
  tenantId: 'tenant-1',
  scope: 'payments.create-intent',
  key: 'key-1',
  requestPayload: { amount: 1 },
};
const HASH = sha256(JSON.stringify(CONTEXT.requestPayload));

function record(overrides: Partial<idempotency_records> = {}): idempotency_records {
  return {
    id: 'idem-1',
    tenant_id: 'tenant-1',
    scope: CONTEXT.scope,
    idempotency_key: 'key-1',
    request_hash: HASH,
    resource_type: null,
    resource_id: null,
    response_json: null,
    status_code: null,
    processing_status: 'started',
    expires_at: null,
    locked_until: new Date(Date.now() + 60_000),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function setup(inserted: boolean, existing: idempotency_records) {
  const repository = {
    tryInsert: jest.fn().mockResolvedValue(inserted),
    find: jest.fn().mockResolvedValue(existing),
    takeOverExpired: jest.fn().mockResolvedValue(false),
    finish: jest.fn().mockResolvedValue(true),
    releaseLease: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const service = new IdempotencyService(repository as unknown as IdempotencyRepository);
  const operation = jest.fn().mockResolvedValue({
    resourceType: 'payment_intent',
    resourceId: 'pi-1',
    response: { id: 'pi-1', totalMinor: 49000n },
    statusCode: 201,
  });
  return { service, repository, operation };
}

describe('IdempotencyService.execute', () => {
  it('key mới -> chạy operation, lưu completed (BigInt đã serialize), trả kết quả', async () => {
    const { service, repository, operation } = setup(true, record());

    await expect(service.execute(CONTEXT, operation)).resolves.toEqual({
      id: 'pi-1',
      totalMinor: 49000n,
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(repository.tryInsert).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'started', locked_until: expect.any(Date) }),
    );
    expect(repository.finish).toHaveBeenCalledWith(
      'idem-1',
      expect.objectContaining({
        processing_status: 'completed',
        response_json: { id: 'pi-1', totalMinor: 49000 },
        locked_until: null,
      }),
    );
  });

  it('key đã completed -> replay, KHÔNG chạy operation lần hai', async () => {
    const { service, operation } = setup(
      false,
      record({ processing_status: 'completed', response_json: { id: 'pi-1' }, status_code: 201 }),
    );

    await expect(service.execute(CONTEXT, operation)).resolves.toEqual({ id: 'pi-1' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('cùng key, payload khác -> 409 conflict', async () => {
    const { service, operation } = setup(false, record({ request_hash: 'other' }));

    await expect(service.execute(CONTEXT, operation)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('payload changed'),
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it('request khác đang xử lý (lease còn hạn) -> 409 in-progress, KHÔNG chạy song song', async () => {
    const { service, operation } = setup(false, record());

    await expect(service.execute(CONTEXT, operation)).rejects.toMatchObject({
      status: 409,
      details: expect.objectContaining({ reason: 'idempotency_in_progress' }),
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it('record `started` hết lease (crash) -> tiếp quản và chạy lại', async () => {
    const { service, repository, operation } = setup(
      false,
      record({ locked_until: new Date(Date.now() - 1000) }),
    );
    repository.takeOverExpired.mockResolvedValue(true);

    await expect(service.execute(CONTEXT, operation)).resolves.toMatchObject({ id: 'pi-1' });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('lỗi nghiệp vụ 4xx -> lưu failed; retry cùng key nhận LẠI đúng lỗi, không chạy lại', async () => {
    const { service, repository, operation } = setup(true, record());
    operation.mockRejectedValueOnce(
      new AppException(PaymentErrorCode.REFUND_AMOUNT_INVALID, {
        message: 'Amount invalid',
        details: { field: 'amount' },
      }),
    );

    await expect(service.execute(CONTEXT, operation)).rejects.toMatchObject({ status: 422 });
    expect(repository.finish).toHaveBeenCalledWith(
      'idem-1',
      expect.objectContaining({
        processing_status: 'failed',
        status_code: 422,
        response_json: {
          code: 'PAYMENT.REFUND_AMOUNT_INVALID',
          message: 'Amount invalid',
          details: { field: 'amount' },
        },
      }),
    );

    const retry = setup(
      false,
      record({
        processing_status: 'failed',
        status_code: 422,
        response_json: {
          code: 'PAYMENT.REFUND_AMOUNT_INVALID',
          message: 'Amount invalid',
          details: { field: 'amount' },
        },
      }),
    );
    await expect(retry.service.execute(CONTEXT, retry.operation)).rejects.toMatchObject({
      status: 422,
      message: 'Amount invalid',
    });
    expect(retry.operation).not.toHaveBeenCalled();
  });

  it('lỗi tạm thời (5xx/không rõ) -> nhả lease, KHÔNG lưu failed (retry chạy lại được)', async () => {
    const { service, repository, operation } = setup(true, record());
    operation.mockRejectedValueOnce(new Error('provider timeout'));

    await expect(service.execute(CONTEXT, operation)).rejects.toThrow('provider timeout');
    expect(repository.releaseLease).toHaveBeenCalledWith('idem-1', expect.any(Date));
    expect(repository.finish).not.toHaveBeenCalled();
  });
});
