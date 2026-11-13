import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { ErrorCode } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { resolveSort } from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import type { DeliveryChannelName } from '../../notifications/domain/channels';
import { requireTenant } from '../../notifications/domain/require-tenant';
import { NotificationErrorCode } from '../../notifications/notification-error-codes';
import { findTemplateProblems } from '../domain/template-engine';
import {
  CreateTemplateDto,
  TemplateQueryDto,
  UpdateTemplateDto,
} from '../dto/template-request.dto';
import { TemplateResponseDto } from '../dto/template-response.dto';
import {
  isTemplateKeyConflict,
  TemplateRow,
  TemplatesRepository,
} from '../repositories/templates.repository';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'eventType'] as const;

@Injectable()
export class TemplatesService {
  constructor(
    private readonly repository: TemplatesRepository,
    private readonly config: AppConfig,
  ) {}

  async create(dto: CreateTemplateDto, actor: Actor): Promise<TemplateResponseDto> {
    const tenantId = requireTenant(actor);
    this.assertCompiles(dto.channel, dto.subject, dto.body);
    try {
      return TemplateResponseDto.from(await this.repository.create({ tenantId, ...dto }));
    } catch (error) {
      if (isTemplateKeyConflict(error)) {
        throw new AppException(NotificationErrorCode.TEMPLATE_KEY_TAKEN);
      }
      throw error;
    }
  }

  async get(id: string, actor: Actor): Promise<TemplateResponseDto> {
    return TemplateResponseDto.from(await this.requireOwned(id, requireTenant(actor)));
  }

  async list(query: TemplateQueryDto, actor: Actor): Promise<PageResponseDto<TemplateResponseDto>> {
    const orderBy = resolveSort(query.sort, SORTABLE_FIELDS, { createdAt: 'desc' });
    const [rows, total] = await this.repository.findPage(
      requireTenant(actor),
      { eventType: query.eventType, channel: query.channel, locale: query.locale },
      orderBy,
      query.skip,
      query.take,
    );
    return PageResponseDto.of(rows.map(TemplateResponseDto.from), query, total);
  }

  async update(id: string, dto: UpdateTemplateDto, actor: Actor): Promise<TemplateResponseDto> {
    const tenantId = requireTenant(actor);
    if (dto.subject === undefined && dto.body === undefined) {
      throw new AppException(ErrorCode.VALIDATION, {
        details: [{ field: 'body', errors: ['subject or body must be provided'] }],
      });
    }
    const existing = await this.requireOwned(id, tenantId);
    this.assertCompiles(
      existing.channel,
      dto.subject ?? existing.subject,
      dto.body ?? existing.body,
    );
    const updated = await this.repository.updateOwned(id, tenantId, dto);
    if (!updated) {
      throw new AppException(NotificationErrorCode.TEMPLATE_NOT_FOUND);
    }
    return TemplateResponseDto.from(updated);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    if (!(await this.repository.deleteOwned(id, requireTenant(actor)))) {
      throw new AppException(NotificationErrorCode.TEMPLATE_NOT_FOUND);
    }
  }

  async resolve(
    tenantId: string,
    eventType: string,
    channel: DeliveryChannelName,
    locale: string,
  ): Promise<TemplateRow | null> {
    const locales = [locale, this.config.notification.defaultLocale];
    const candidates = await this.repository.findCandidates(tenantId, eventType, channel, locales);
    return (
      locales.map((wanted) => candidates.find((row) => row.locale === wanted)).find(Boolean) ?? null
    );
  }

  channelsWithTemplate(tenantId: string, eventType: string): Promise<DeliveryChannelName[]> {
    return this.repository.channelsWithTemplate(tenantId, eventType);
  }

  private async requireOwned(id: string, tenantId: string): Promise<TemplateRow> {
    const row = await this.repository.findOwned(id, tenantId);
    if (!row) {
      throw new AppException(NotificationErrorCode.TEMPLATE_NOT_FOUND);
    }
    return row;
  }

  private assertCompiles(channel: DeliveryChannelName, subject: string, body: string): void {
    const details = [
      { field: 'subject', errors: findTemplateProblems(subject, { allowRawOutput: true }) },
      {
        field: 'body',
        errors: findTemplateProblems(body, { allowRawOutput: channel !== 'EMAIL' }),
      },
    ].filter((entry) => entry.errors.length > 0);
    if (details.length > 0) {
      throw new AppException(NotificationErrorCode.TEMPLATE_INVALID, { details });
    }
  }
}
