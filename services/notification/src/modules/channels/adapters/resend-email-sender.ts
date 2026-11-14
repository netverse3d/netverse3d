import { z } from 'zod';
import {
  assertAccepted,
  ChannelSender,
  OutboundMessage,
  SendReceipt,
} from '../ports/channel-sender';
import { EmailProvider, EmailSenderContext, formatSender } from '../ports/email-provider';

const RESEND_SEND_URL = 'https://api.resend.com/emails';
const PERMANENT_STATUSES = new Set([400, 404, 422]);

export class ResendEmailSender extends ChannelSender {
  constructor(
    private readonly apiKey: string,
    private readonly context: EmailSenderContext,
  ) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const response = await fetch(RESEND_SEND_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'idempotency-key': message.deliveryId,
      },
      body: JSON.stringify({
        from: formatSender(this.context, message.senderName),
        to: [message.destination],
        subject: message.subject,
        html: message.body,
      }),
      signal: AbortSignal.timeout(this.context.timeoutMs),
    });
    assertAccepted(response, PERMANENT_STATUSES, 'Resend');
    const { id } = (await response.json()) as { id?: string };
    return { providerMessageId: id };
  }
}

export const resendProvider: EmailProvider = {
  name: 'resend',
  env: { RESEND_API_KEY: z.string().min(1).optional() },
  required: ['RESEND_API_KEY'],
  secrets: ['RESEND_API_KEY'],
  create: (settings, context) => new ResendEmailSender(settings.RESEND_API_KEY as string, context),
};
