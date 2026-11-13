import type { DeliveryChannelName } from '../../notifications/domain/channels';
import { DeliveryReason, DeliveryReasonCode } from '../../notifications/domain/delivery-reasons';

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

export class ProviderConfigurationError extends Error {}

const CREDENTIAL_STATUSES: ReadonlySet<number> = new Set([401, 403]);

export function assertAccepted(
  response: Response,
  permanentStatuses: ReadonlySet<number>,
  provider: string,
  credentialStatuses: ReadonlySet<number> = CREDENTIAL_STATUSES,
): void {
  if (permanentStatuses.has(response.status)) {
    throw new PermanentSendError(
      DeliveryReason.PROVIDER_REJECTED,
      `${provider} rejected the message with status ${response.status}`,
    );
  }
  if (credentialStatuses.has(response.status)) {
    throw new ProviderConfigurationError(`${provider} answered ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`${provider} answered ${response.status}`);
  }
}

export abstract class ChannelSender {
  abstract send(message: OutboundMessage): Promise<SendReceipt>;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';
export const PUSH_SENDER = 'PUSH_SENDER';
export const IN_APP_SENDER = 'IN_APP_SENDER';
