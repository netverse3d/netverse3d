import { z } from 'zod';
import { ChannelSender, OutboundMessage, SendReceipt } from '../ports/channel-sender';
import { assertAccepted, EmailProvider, EmailSenderContext } from '../ports/email-provider';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const PERMANENT_STATUSES = new Set([400, 404, 422]);

export class BrevoEmailSender extends ChannelSender {
  constructor(
    private readonly apiKey: string,
    private readonly context: EmailSenderContext,
  ) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        sender: { email: this.context.fromAddress, name: this.context.fromName },
        to: [{ email: message.destination }],
        subject: message.subject,
        htmlContent: message.body,
      }),
      signal: AbortSignal.timeout(this.context.timeoutMs),
    });
    assertAccepted(response, PERMANENT_STATUSES, 'Brevo');
    const { messageId } = (await response.json()) as { messageId?: string };
    return { providerMessageId: messageId };
  }
}

export const brevoProvider: EmailProvider = {
  name: 'brevo',
  env: { BREVO_API_KEY: z.string().min(1).optional() },
  required: ['BREVO_API_KEY'],
  secrets: ['BREVO_API_KEY'],
  create: (settings, context) => new BrevoEmailSender(settings.BREVO_API_KEY as string, context),
};
