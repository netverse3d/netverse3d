import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import { TemplatesService } from '../../templates/services/templates.service';
import type { DeliveryChannelName } from '../domain/channels';
import { MAX_IDEMPOTENCY_KEY_LENGTH } from '../domain/limits';
import { scopeOf } from '@netverse/nest-kit';
import { PLATFORM_SCOPE } from '@netverse/nest-kit';
import { AcceptedNotificationDto, SendNotificationDto } from '../dto/notification.dto';
import { NotificationErrorCode } from '../notification-error-codes';
import {
  isIdempotencyConflict,
  NewDelivery,
  NotificationsRepository,
  NotificationSourceName,
  NotificationWithDeliveries,
} from '../repositories/notifications.repository';

export interface RecipientInput {
  subject?: string;
  email?: string;
  deviceTokens?: string[];
}

export interface IntakeCommand {
  tenantId: string;
  source: NotificationSourceName;
  idempotencyKey?: string;
  eventType: string;
  locale?: string;
  channels?: DeliveryChannelName[];
  recipient: RecipientInput;
  variables: Record<string, unknown>;
  expiresAt?: Date;
}

const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function containsNullCharacter(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes('\u0000');
  }
  if (Array.isArray(value)) {
    return value.some(containsNullCharacter);
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, item]) => key.includes('\u0000') || containsNullCharacter(item),
    );
  }
  return false;
}

function uniqueTokens(tokens: string[] | undefined): string[] {
  return [...new Set(tokens ?? [])];
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly templates: TemplatesService,
    private readonly config: AppConfig,
  ) {}

  async send(
    dto: SendNotificationDto,
    idempotencyKey: string | undefined,
    actor: Actor,
  ): Promise<AcceptedNotificationDto> {
    return AcceptedNotificationDto.from(
      await this.accept({
        tenantId: scopeOf(actor),
        source: 'API',
        idempotencyKey: idempotencyKey || undefined,
        eventType: dto.eventType,
        locale: dto.locale,
        channels: dto.channels,
        recipient: dto.recipient,
        variables: dto.variables ?? {},
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      }),
    );
  }

  async accept(command: IntakeCommand): Promise<NotificationWithDeliveries> {
    this.assertAcceptable(command);
    const requestHash = this.hashRequest(command);
    if (command.idempotencyKey) {
      const replay = await this.findReplay(command, requestHash);
      if (replay) {
        return replay;
      }
    }
    const channels = await this.planChannels(command);
    await this.assertSendable(command, channels);
    try {
      return await this.repository.create({
        tenantId: command.tenantId,
        source: command.source,
        idempotencyKey: command.idempotencyKey ?? null,
        requestHash,
        eventType: command.eventType,
        locale: command.locale ?? this.config.notification.defaultLocale,
        variables: command.variables,
        recipientSubject: command.recipient.subject ?? null,
        recipientEmail: command.recipient.email ?? null,
        expiresAt: command.expiresAt ?? null,
        deliveries: channels.flatMap((channel) => this.deliveriesFor(channel, command.recipient)),
      });
    } catch (error) {
      if (command.idempotencyKey && isIdempotencyConflict(error)) {
        const raced = await this.findReplay(command, requestHash);
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private assertAcceptable(command: IntakeCommand): void {
    if (
      !command.recipient.subject &&
      !command.recipient.email &&
      uniqueTokens(command.recipient.deviceTokens).length === 0
    ) {
      throw new AppException(NotificationErrorCode.RECIPIENT_REQUIRED);
    }
    if (command.expiresAt && command.expiresAt.getTime() <= Date.now()) {
      throw new AppException(NotificationErrorCode.EXPIRES_AT_PAST);
    }
    if (command.idempotencyKey && command.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new AppException(NotificationErrorCode.IDEMPOTENCY_KEY_INVALID);
    }
    if (containsNullCharacter(command)) {
      throw new AppException(NotificationErrorCode.INVALID_CHARACTERS);
    }
  }

  private async assertSendable(
    command: IntakeCommand,
    channels: DeliveryChannelName[],
  ): Promise<void> {
    if (!command.recipient.subject) {
      const locale = command.locale ?? this.config.notification.defaultLocale;
      const templates = await Promise.all(
        channels.map((channel) =>
          this.templates.resolve(command.tenantId, command.eventType, channel, locale),
        ),
      );
      if (templates.some((template) => template?.category === 'OPTIONAL')) {
        throw new AppException(NotificationErrorCode.RECIPIENT_SUBJECT_REQUIRED);
      }
    }
    const metered =
      command.source === 'API' &&
      command.tenantId !== PLATFORM_SCOPE &&
      channels.includes('EMAIL') &&
      Boolean(command.recipient.email);
    if (!metered) {
      return;
    }
    const sent = await this.repository.countApiEmailsSince(
      command.tenantId,
      new Date(Date.now() - QUOTA_WINDOW_MS),
    );
    if (sent >= this.config.notification.tenantDailyEmailLimit) {
      throw new AppException(NotificationErrorCode.EMAIL_QUOTA_EXCEEDED);
    }
  }

  private hashRequest(command: IntakeCommand): Uint8Array<ArrayBuffer> {
    const { eventType, locale, channels, recipient, variables } = command;
    const canonical = canonicalJson({ eventType, locale, channels, recipient, variables });
    return new Uint8Array(createHash('sha256').update(canonical).digest());
  }

  private async findReplay(
    command: IntakeCommand,
    requestHash: Uint8Array<ArrayBuffer>,
  ): Promise<NotificationWithDeliveries | null> {
    const existing = await this.repository.findByKey(
      command.tenantId,
      command.source,
      command.idempotencyKey as string,
    );
    if (!existing) {
      return null;
    }
    if (
      !existing.requestHash ||
      !Buffer.from(existing.requestHash).equals(Buffer.from(requestHash))
    ) {
      throw new AppException(NotificationErrorCode.IDEMPOTENCY_KEY_REUSED);
    }
    return existing;
  }

  private async planChannels(command: IntakeCommand): Promise<DeliveryChannelName[]> {
    if (command.channels?.length) {
      return [...new Set(command.channels)];
    }
    const { subject, email, deviceTokens } = command.recipient;
    const addressable: DeliveryChannelName[] = [
      ...(subject ? (['IN_APP'] as const) : []),
      ...(email ? (['EMAIL'] as const) : []),
      ...(uniqueTokens(deviceTokens).length > 0 ? (['PUSH'] as const) : []),
    ];
    const templated = await this.templates.channelsWithTemplate(
      command.tenantId,
      command.eventType,
    );
    const overlap = addressable.filter((channel) => templated.includes(channel));
    return overlap.length > 0 ? overlap : addressable;
  }

  private deliveriesFor(channel: DeliveryChannelName, recipient: RecipientInput): NewDelivery[] {
    switch (channel) {
      case 'EMAIL':
        return [{ channel, destination: recipient.email ?? null }];
      case 'IN_APP':
        return [{ channel, destination: recipient.subject ?? null }];
      case 'PUSH': {
        const tokens = uniqueTokens(recipient.deviceTokens);
        return tokens.length > 0
          ? tokens.map((destination) => ({ channel, destination }))
          : [{ channel, destination: null }];
      }
    }
  }
}
