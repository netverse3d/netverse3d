import { Injectable } from '@nestjs/common';
import { InputJson, JsonValue, idempotency_records } from '@app/infrastructure/prisma/prisma.types';
import { AppException } from '@app/common/errors/app.exception';
import { ErrorCodeDefinition, errorCodeForStatus } from '@app/common/errors/error-code';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { sha256 } from '@app/common/utils/hash.util';
import { normalizeForJson } from '@app/common/utils/serialization.util';
import { IdempotencyRepository } from '../repositories/idempotency.repository';

export const IDEMPOTENCY_LEASE_MS = 60_000;

function replayedDefinition(status: number, code: string | undefined): ErrorCodeDefinition {
  const fallback = errorCodeForStatus(status);
  return { ...fallback, code: code ?? fallback.code, httpStatus: status };
}

export interface IdempotentResult<T> {
  resourceType: string;
  resourceId: string;
  response: T;
  statusCode: number;
}

export interface IdempotencyContext {
  tenantId: string;
  scope: string;
  key: string;
  requestPayload: unknown;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly repository: IdempotencyRepository) {}

  async execute<T>(
    context: IdempotencyContext,
    operation: () => Promise<IdempotentResult<T>>,
  ): Promise<T | JsonValue> {
    const acquired = await this.acquire(context);
    if (acquired.kind === 'replay') return acquired.response;

    let result: IdempotentResult<T>;
    try {
      result = await operation();
    } catch (error) {
      await this.recordFailure(acquired.record.id, error);
      throw error;
    }

    await this.repository.finish(acquired.record.id, {
      resource_type: result.resourceType,
      resource_id: result.resourceId,
      response_json: normalizeForJson(result.response ?? null) as InputJson,
      status_code: result.statusCode,
      processing_status: 'completed',
      locked_until: null,
    });
    return result.response;
  }

  private async acquire(
    context: IdempotencyContext,
  ): Promise<
    { kind: 'proceed'; record: idempotency_records } | { kind: 'replay'; response: JsonValue }
  > {
    const requestHash = sha256(JSON.stringify(context.requestPayload ?? {}));
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + IDEMPOTENCY_LEASE_MS);

    const inserted = await this.repository.tryInsert({
      tenant_id: context.tenantId,
      scope: context.scope,
      idempotency_key: context.key,
      request_hash: requestHash,
      processing_status: 'started',
      locked_until: lockedUntil,
    });
    const record = await this.repository.find(context.tenantId, context.scope, context.key);
    if (!record) throw new AppException(PaymentErrorCode.IDEMPOTENCY_RECORD_MISSING);
    if (inserted) return { kind: 'proceed', record };

    if (record.request_hash !== requestHash) {
      throw new AppException(PaymentErrorCode.IDEMPOTENCY_CONFLICT);
    }
    if (record.processing_status === 'completed') {
      return { kind: 'replay', response: record.response_json };
    }
    if (record.processing_status === 'failed') {
      const stored = (record.response_json ?? {}) as {
        code?: string;
        message?: string;
        details?: unknown;
      };
      throw new AppException(replayedDefinition(record.status_code ?? 400, stored.code), {
        message: stored.message ?? 'Idempotent request previously failed',
        details: stored.details ?? undefined,
      });
    }
    if (await this.repository.takeOverExpired(record.id, now, lockedUntil)) {
      return { kind: 'proceed', record };
    }
    throw new AppException(PaymentErrorCode.IDEMPOTENCY_IN_PROGRESS, {
      details: {
        reason: 'idempotency_in_progress',
        retryAfterSeconds: Math.ceil(IDEMPOTENCY_LEASE_MS / 1000),
      },
    });
  }

  private async recordFailure(recordId: string, error: unknown) {
    if (error instanceof AppException && error.getStatus() >= 400 && error.getStatus() < 500) {
      await this.repository.finish(recordId, {
        processing_status: 'failed',
        status_code: error.getStatus(),
        response_json: normalizeForJson({
          code: error.definition.code,
          message: error.message,
          details: error.details ?? null,
        }) as InputJson,
        locked_until: null,
      });
      return;
    }
    await this.repository.releaseLease(recordId, new Date());
  }
}
