import type { DeliveryChannelName } from '../../notifications/domain/channels';
import type { DeliveryReasonCode } from '../../notifications/domain/delivery-reasons';

export interface OutboundMessage {
  deliveryId: string;
  tenantId: string;
  eventType: string;
  channel: DeliveryChannelName;
  destination: string;
  subject: string;
  body: string;
}

export interface SendReceipt {
  providerMessageId?: string;
}

export class PermanentSendError extends Error {
  constructor(
    readonly reason: DeliveryReasonCode,
    message: string,
  ) {
    super(message);
  }
}

export abstract class ChannelSender {
  abstract send(message: OutboundMessage): Promise<SendReceipt>;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';
export const PUSH_SENDER = 'PUSH_SENDER';
export const IN_APP_SENDER = 'IN_APP_SENDER';
