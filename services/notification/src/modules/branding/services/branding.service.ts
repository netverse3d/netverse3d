import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { ErrorCode } from '@netverse/nest-kit';
import { BRAND_KEY_PATTERN, MAX_BRAND_KEY_LENGTH } from '../../notifications/domain/limits';
import { requireTenant } from '../../notifications/domain/require-tenant';
import { NotificationErrorCode } from '../../notifications/notification-error-codes';
import {
  BrandingEntryResponseDto,
  BrandingResponseDto,
  PutBrandingEntryDto,
} from '../dto/branding.dto';
import { BrandingRepository } from '../repositories/branding.repository';

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

@Injectable()
export class BrandingService {
  constructor(private readonly repository: BrandingRepository) {}

  async list(actor: Actor): Promise<BrandingResponseDto> {
    const rows = await this.repository.findAll(requireTenant(actor));
    return { entries: rows.map(BrandingEntryResponseDto.from) };
  }

  async put(
    key: string,
    dto: PutBrandingEntryDto,
    actor: Actor,
  ): Promise<BrandingEntryResponseDto> {
    this.assertKey(key);
    return BrandingEntryResponseDto.from(
      await this.repository.upsert(requireTenant(actor), key, dto.value),
    );
  }

  async remove(key: string, actor: Actor): Promise<void> {
    if (!(await this.repository.delete(requireTenant(actor), key))) {
      throw new AppException(NotificationErrorCode.BRANDING_NOT_FOUND);
    }
  }

  async asVariables(tenantId: string): Promise<Record<string, string>> {
    const rows = await this.repository.findAll(tenantId);
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  private assertKey(key: string): void {
    if (
      key.length > MAX_BRAND_KEY_LENGTH ||
      !BRAND_KEY_PATTERN.test(key) ||
      RESERVED_KEYS.has(key)
    ) {
      throw new AppException(ErrorCode.VALIDATION, {
        details: [{ field: 'key', errors: ['key must be a short alphanumeric identifier'] }],
      });
    }
  }
}
