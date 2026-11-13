import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import type { DeliveryChannelName } from '../../notifications/domain/channels';
import { requireTenant } from '../../notifications/domain/require-tenant';
import { NotificationErrorCode } from '../../notifications/notification-error-codes';
import {
  BlockAddressDto,
  BlockedAddressResponseDto,
  OptOutKeyDto,
  OptOutListResponseDto,
  OptOutResponseDto,
} from '../dto/preferences.dto';
import {
  isBlockedAddressConflict,
  PreferencesRepository,
} from '../repositories/preferences.repository';

export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
}

@Injectable()
export class PreferencesService {
  constructor(private readonly repository: PreferencesRepository) {}

  async listOptOuts(actor: Actor): Promise<OptOutListResponseDto> {
    const rows = await this.repository.findOptOuts(requireTenant(actor), actor.subject);
    return { optOuts: rows.map(OptOutResponseDto.from) };
  }

  async optOut(dto: OptOutKeyDto, actor: Actor): Promise<OptOutResponseDto> {
    return OptOutResponseDto.from(
      await this.repository.upsertOptOut({
        tenantId: requireTenant(actor),
        subject: actor.subject,
        ...dto,
      }),
    );
  }

  async optIn(dto: OptOutKeyDto, actor: Actor): Promise<void> {
    await this.repository.deleteOptOut({
      tenantId: requireTenant(actor),
      subject: actor.subject,
      ...dto,
    });
  }

  async block(dto: BlockAddressDto, actor: Actor): Promise<BlockedAddressResponseDto> {
    try {
      return BlockedAddressResponseDto.from(
        await this.repository.createBlockedAddress({
          tenantId: requireTenant(actor),
          address: normalizeAddress(dto.address),
          reason: dto.reason ?? null,
          createdBy: actor.subject,
        }),
      );
    } catch (error) {
      if (isBlockedAddressConflict(error)) {
        throw new AppException(NotificationErrorCode.ADDRESS_ALREADY_BLOCKED);
      }
      throw error;
    }
  }

  async listBlocked(
    query: PaginationQueryDto,
    actor: Actor,
  ): Promise<PageResponseDto<BlockedAddressResponseDto>> {
    const [rows, total] = await this.repository.findBlockedPage(
      requireTenant(actor),
      query.skip,
      query.take,
    );
    return PageResponseDto.of(rows.map(BlockedAddressResponseDto.from), query, total);
  }

  async unblock(id: string, actor: Actor): Promise<void> {
    if (!(await this.repository.deleteBlockedAddress(id, requireTenant(actor)))) {
      throw new AppException(NotificationErrorCode.BLOCKED_ADDRESS_NOT_FOUND);
    }
  }

  isOptedOut(
    tenantId: string,
    subject: string,
    channel: DeliveryChannelName,
    eventType: string,
  ): Promise<boolean> {
    return this.repository.optOutExists({ tenantId, subject, channel, eventType });
  }

  isBlocked(tenantId: string, address: string): Promise<boolean> {
    return this.repository.addressIsBlocked(tenantId, normalizeAddress(address));
  }
}
