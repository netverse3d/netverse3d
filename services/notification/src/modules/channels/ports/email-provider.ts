import type { z } from 'zod';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import { ChannelSender, PermanentSendError } from './channel-sender';

export interface EmailSenderContext {
  fromAddress: string;
  fromName?: string;
  timeoutMs: number;
}

export interface EmailProvider {
  name: string;
  env: z.ZodRawShape;
  required: readonly string[];
  secrets: readonly string[];
  create(settings: Record<string, unknown>, context: EmailSenderContext): ChannelSender;
}

export function formatSender(context: EmailSenderContext): string {
  return context.fromName ? `${context.fromName} <${context.fromAddress}>` : context.fromAddress;
}

export function assertAccepted(
  response: Response,
  permanentStatuses: ReadonlySet<number>,
  provider: string,
): void {
  if (permanentStatuses.has(response.status)) {
    throw new PermanentSendError(
      DeliveryReason.PROVIDER_REJECTED,
      `${provider} rejected the message with status ${response.status}`,
    );
  }
  if (!response.ok) {
    throw new Error(`${provider} answered ${response.status}`);
  }
}
