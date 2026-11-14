import { PrismaKnownError, uniqueViolation } from '@test/support/prisma-errors';
import { CurrentTenantPayload } from '@app/common/decorators/current-tenant.decorator';
import { CustomerService } from '@app/modules/customers/services/customer.service';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { CreatePaymentIntentDto } from '@app/modules/payments/dto/create-payment-intent.dto';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { PaymentIntentService } from '@app/modules/payments/services/payment-intent.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const TENANT = { tenantId: 'tenant-1' } as CurrentTenantPayload;
const DTO: CreatePaymentIntentDto = {
  merchantReference: 'merchant:subscription:s1',
  targetType: 'user_subscription',
  targetRef: 'user-1',
  targetSnapshot: {},
  title: 'Pro',
  currency: 'vnd',
  subtotalMinor: 49000,
};

function setup() {
  const repository = {
    create: jest.fn().mockRejectedValue(uniqueViolation()),
    findByMerchantReference: jest.fn(),
  };
  const idempotency = {
    execute: jest.fn(
      async (_context: unknown, operation: () => Promise<{ response: unknown }>) =>
        (await operation()).response,
    ),
  };
  const service = new PaymentIntentService(
    repository as unknown as PaymentIntentRepository,
    {} as CustomerService,
    idempotency as unknown as IdempotencyService,
  );
  return { service, repository };
}

describe('PaymentIntentService.create — merchant_reference là chốt domain', () => {
  it('từ chối mọi khoản tiền vượt Number.MAX_SAFE_INTEGER', async () => {
    const dto = plainToInstance(CreatePaymentIntentDto, {
      ...DTO,
      subtotalMinor: Number.MAX_SAFE_INTEGER + 1,
      discountMinor: Number.MAX_SAFE_INTEGER + 1,
      feeMinor: Number.MAX_SAFE_INTEGER + 1,
      taxMinor: Number.MAX_SAFE_INTEGER + 1,
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['subtotalMinor', 'discountMinor', 'feeMinor', 'taxMinor']),
    );
  });

  it('trùng merchant_reference của CÙNG giao dịch (chạy lại sau crash) -> trả intent sẵn có', async () => {
    const { service, repository } = setup();
    const existing = {
      id: 'pi-1',
      total_minor: 49000n,
      currency: 'VND',
      target_type: 'user_subscription',
      target_ref: 'user-1',
    };
    repository.findByMerchantReference.mockResolvedValue(existing);

    await expect(service.create(TENANT, 'key-2', DTO)).resolves.toBe(existing);
    expect(repository.findByMerchantReference).toHaveBeenCalledWith(
      'tenant-1',
      'merchant:subscription:s1',
    );
  });

  it('trùng merchant_reference nhưng KHÁC số tiền/target -> 409, không trả nhầm intent', async () => {
    const { service, repository } = setup();
    repository.findByMerchantReference.mockResolvedValue({
      id: 'pi-1',
      total_minor: 99000n,
      currency: 'VND',
      target_type: 'user_subscription',
      target_ref: 'user-1',
    });

    await expect(service.create(TENANT, 'key-2', DTO)).rejects.toMatchObject({ status: 409 });
  });

  it('P2002 khi KHÔNG có merchant_reference -> ném nguyên lỗi (không đoán)', async () => {
    const { service } = setup();
    const withoutRef = { ...DTO };
    delete withoutRef.merchantReference;

    await expect(service.create(TENANT, 'key-2', withoutRef)).rejects.toBeInstanceOf(
      PrismaKnownError,
    );
  });
});
