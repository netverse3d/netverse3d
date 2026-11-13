import { createHash } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  AppException,
  CommandCall,
  ErrorCode,
  flattenValidationErrors,
  GrpcServer,
  loadContract,
} from '@netverse/nest-kit';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Channel__Output } from '../../../generated/grpc/netverse/notification/v1/Channel';
import type { SendReply } from '../../../generated/grpc/netverse/notification/v1/SendReply';
import type { SendRequest__Output } from '../../../generated/grpc/netverse/notification/v1/SendRequest';
import { DeliveryChannelName } from '../domain/channels';
import { ROLE_NOTIFICATION_SEND } from '../domain/limits';
import { SendNotificationDto } from '../dto/notification.dto';
import { isScope } from '../domain/scope';
import { NotificationErrorCode } from '../notification-error-codes';
import { NotificationsService } from '../services/notifications.service';

const CONTRACT = 'notification';
const SERVICE = 'netverse.notification.v1.NotificationCommands';

function keyOwnedBy(clientId: string, idempotencyKey: string): string {
  return createHash('sha256').update(`${clientId}\n${idempotencyKey}`).digest('hex');
}

const CHANNEL_NAMES: Partial<Record<Channel__Output, DeliveryChannelName>> = {
  CHANNEL_EMAIL: 'EMAIL',
  CHANNEL_PUSH: 'PUSH',
  CHANNEL_IN_APP: 'IN_APP',
};
const CONTRACT_CHANNELS: Record<DeliveryChannelName, Channel__Output> = {
  EMAIL: 'CHANNEL_EMAIL',
  PUSH: 'CHANNEL_PUSH',
  IN_APP: 'CHANNEL_IN_APP',
};

function invalid(field: string, problem: string): AppException {
  return new AppException(ErrorCode.VALIDATION, { details: [{ field, errors: [problem] }] });
}

function variablesOf(json: string): Record<string, unknown> {
  if (json === '') {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw invalid('variablesJson', 'must be a JSON object');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw invalid('variablesJson', 'must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function channelsOf(channels: Channel__Output[]): DeliveryChannelName[] | undefined {
  if (channels.length === 0) {
    return undefined;
  }
  return channels.map((channel) => {
    const name = CHANNEL_NAMES[channel];
    if (!name) {
      throw invalid('channels', `${channel} is not a delivery channel`);
    }
    return name;
  });
}

function textOrNone(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

@Injectable()
export class NotificationCommands implements OnModuleInit {
  constructor(
    private readonly grpc: GrpcServer,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.grpc.register(loadContract(CONTRACT), SERVICE, {
      Send: {
        permission: ROLE_NOTIFICATION_SEND,
        handle: (request: SendRequest__Output, call: CommandCall) => this.send(request, call),
      },
    });
  }

  private async send(request: SendRequest__Output, call: CommandCall): Promise<SendReply> {
    if (!isScope(request.scope)) {
      throw new AppException(NotificationErrorCode.SCOPE_REQUIRED);
    }
    const dto = plainToInstance(SendNotificationDto, {
      eventType: request.eventType,
      recipient: {
        subject: textOrNone(request.recipient?.subject),
        email: textOrNone(request.recipient?.email),
        deviceTokens: request.recipient?.deviceTokens.length
          ? request.recipient.deviceTokens
          : undefined,
      },
      variables: variablesOf(request.variablesJson),
      locale: textOrNone(request.locale),
      channels: channelsOf(request.channels),
    });
    const violations = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (violations.length > 0) {
      throw new AppException(ErrorCode.VALIDATION, {
        details: flattenValidationErrors(violations),
      });
    }
    const accepted = await this.notifications.accept({
      tenantId: request.scope,
      source: 'SERVICE',
      idempotencyKey: keyOwnedBy(
        call.caller.service?.clientId ?? call.caller.subject,
        call.idempotencyKey,
      ),
      eventType: dto.eventType,
      locale: dto.locale,
      channels: dto.channels,
      recipient: dto.recipient,
      variables: dto.variables ?? {},
    });
    return {
      notificationId: accepted.id,
      deliveries: accepted.deliveries.map((delivery) => ({
        id: delivery.id,
        channel: CONTRACT_CHANNELS[delivery.channel],
        status: delivery.status,
      })),
    };
  }
}
