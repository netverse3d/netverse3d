import { Injectable } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { safeEqualString, sha256 } from '@app/modules/shared/utils/hash.util';
import { ApiKeyAuthRepository } from '../repositories/api-key-auth.repository';

@Injectable()
export class ApiKeyAuthService {
  constructor(private readonly repository: ApiKeyAuthRepository) {}

  async authenticate(rawApiKey: string) {
    const [prefix, secret] = rawApiKey.split('.', 2);
    if (!prefix || !secret) throw new AppException(PaymentErrorCode.API_KEY_MALFORMED);

    const row = await this.repository.findByPrefix(prefix);
    if (!row || row.status !== 'active' || row.tenants.status !== 'active') {
      throw new AppException(PaymentErrorCode.API_KEY_INVALID);
    }
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
      throw new AppException(PaymentErrorCode.API_KEY_EXPIRED);
    }
    if (!safeEqualString(row.secret_hash, sha256(secret))) {
      throw new AppException(PaymentErrorCode.API_KEY_INVALID, { message: 'API key is invalid' });
    }

    await this.repository.touchLastUsed(row.id);
    return { apiKey: row, tenant: row.tenants };
  }
}
