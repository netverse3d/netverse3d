import { AppConfig } from '../../../config/app-config';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import {
  ChannelSender,
  OutboundMessage,
  PermanentSendError,
  SendReceipt,
} from '../ports/channel-sender';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const PERMANENT_STATUSES = new Set([400, 404, 422]);

export class BrevoEmailSender extends ChannelSender {
  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.config.email.brevoApiKey as string,
      },
      body: JSON.stringify({
        sender: { email: this.config.email.fromAddress, name: this.config.email.fromName },
        to: [{ email: message.destination }],
        subject: message.subject,
        htmlContent: message.body,
      }),
      signal: AbortSignal.timeout(this.config.providers.timeoutMs),
    });
    if (PERMANENT_STATUSES.has(response.status)) {
      throw new PermanentSendError(
        DeliveryReason.PROVIDER_REJECTED,
        `Email provider rejected the message with status ${response.status}`,
      );
    }
    if (!response.ok) {
      throw new Error(`Email provider answered ${response.status}`);
    }
    const { messageId } = (await response.json()) as { messageId?: string };
    return { providerMessageId: messageId };
  }
}
