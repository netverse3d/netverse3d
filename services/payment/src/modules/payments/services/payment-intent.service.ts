import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  InputJson,
  JSON_NULL,
  PaymentIntentCreateInput,
  isUniqueViolation,
} from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { CurrentTenantPayload } from '@app/common/decorators/current-tenant.decorator';
import { ensurePositiveMinorAmount, sumMinorAmounts } from '@app/common/utils/money.util';
import { CustomerService } from '@app/modules/customers/services/customer.service';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { IDEMPOTENCY_SCOPE_CREATE_INTENT } from '../constants/payment.constants';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { PaymentIntentRepository } from '../repositories/payment-intent.repository';

@Injectable()
export class PaymentIntentService {
  constructor(
    private readonly repository: PaymentIntentRepository,
    private readonly customerService: CustomerService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(tenant: CurrentTenantPayload, idempotencyKey: string, dto: CreatePaymentIntentDto) {
    if (!idempotencyKey?.trim()) {
      throw new AppException(PaymentErrorCode.IDEMPOTENCY_KEY_REQUIRED);
    }

    return this.idempotencyService.execute(
      {
        tenantId: tenant.tenantId,
        scope: IDEMPOTENCY_SCOPE_CREATE_INTENT,
        key: idempotencyKey.trim(),
        requestPayload: dto,
      },
      async () => {
        const intent = await this.createIntent(tenant, dto);
        return {
          resourceType: 'payment_intent',
          resourceId: intent.id,
          response: intent,
          statusCode: 201,
        };
      },
    );
  }

  private async createIntent(tenant: CurrentTenantPayload, dto: CreatePaymentIntentDto) {
    const subtotalMinor = BigInt(dto.subtotalMinor);
    const discountMinor = BigInt(dto.discountMinor ?? 0);
    const feeMinor = BigInt(dto.feeMinor ?? 0);
    const taxMinor = BigInt(dto.taxMinor ?? 0);
    const totalMinor = sumMinorAmounts(subtotalMinor, feeMinor, taxMinor, -discountMinor);
    ensurePositiveMinorAmount(totalMinor, 'totalMinor');

    const customer = dto.customer
      ? await this.customerService.resolveOrCreate(tenant.tenantId, dto.customer)
      : null;

    const data = {
      public_id: `pi_${randomBytes(6).toString('hex')}`,
      merchant_reference: dto.merchantReference ?? null,
      target_type: dto.targetType,
      target_ref: dto.targetRef,
      target_snapshot: dto.targetSnapshot as InputJson,
      title: dto.title,
      description: dto.description ?? null,
      currency: (dto.currency ?? 'VND').toUpperCase(),
      subtotal_minor: subtotalMinor,
      discount_minor: discountMinor,
      fee_minor: feeMinor,
      tax_minor: taxMinor,
      total_minor: totalMinor,
      metadata_json: dto.metadata ? (dto.metadata as InputJson) : JSON_NULL,
      tenants: { connect: { id: tenant.tenantId } },
      customers: customer ? { connect: { id: customer.id } } : undefined,
    } satisfies PaymentIntentCreateInput;

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (!isUniqueViolation(error) || !dto.merchantReference) {
        throw error;
      }
      const existing = await this.repository.findByMerchantReference(
        tenant.tenantId,
        dto.merchantReference,
      );
      if (
        existing &&
        existing.total_minor === totalMinor &&
        existing.currency === data.currency &&
        existing.target_type === dto.targetType &&
        existing.target_ref === dto.targetRef
      ) {
        return existing;
      }
      throw new AppException(PaymentErrorCode.MERCHANT_REFERENCE_CONFLICT);
    }
  }

  async findOne(tenantId: string, publicId: string) {
    const intent = await this.repository.findByPublicId(tenantId, publicId);
    if (!intent) throw new AppException(PaymentErrorCode.PAYMENT_INTENT_NOT_FOUND);
    return intent;
  }
}
