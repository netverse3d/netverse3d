import MailComposer from 'nodemailer/lib/mail-composer';
import { z } from 'zod';
import {
  assertAccepted,
  ChannelSender,
  OutboundMessage,
  ProviderConfigurationError,
  SendReceipt,
} from '../ports/channel-sender';
import { AccessToken, AccessTokenCache, accessTokenFrom } from './access-token-cache';
import { EmailProvider, EmailSenderContext, formatSender } from '../ports/email-provider';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const PERMANENT_STATUSES = new Set([400]);
const CREDENTIAL_STATUSES = new Set([401]);
const REVOKED_GRANT_STATUSES = new Set([400, 401]);

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export class GmailApiEmailSender extends ChannelSender {
  private readonly tokens = new AccessTokenCache(() => this.refresh());

  constructor(
    private readonly credentials: GmailCredentials,
    private readonly context: EmailSenderContext,
  ) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const raw = await new MailComposer({
      from: formatSender(this.context),
      to: message.destination,
      subject: message.subject,
      html: message.body,
    })
      .compile()
      .build();
    const accessToken = await this.tokens.get();
    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ raw: raw.toString('base64url') }),
      signal: AbortSignal.timeout(this.context.timeoutMs),
    });
    if (response.status === 401) {
      this.tokens.discard(accessToken);
    }
    assertAccepted(response, PERMANENT_STATUSES, 'Gmail', CREDENTIAL_STATUSES);
    const { id } = (await response.json()) as { id?: string };
    return { providerMessageId: id };
  }

  private async refresh(): Promise<AccessToken> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
      }),
      signal: AbortSignal.timeout(this.context.timeoutMs),
    });
    if (!response.ok) {
      const message = `Google did not issue an access token, it answered ${response.status}`;
      throw REVOKED_GRANT_STATUSES.has(response.status)
        ? new ProviderConfigurationError(message)
        : new Error(message);
    }
    return accessTokenFrom((await response.json()) as { access_token?: string });
  }
}

export const gmailApiProvider: EmailProvider = {
  name: 'gmail-api',
  env: {
    GMAIL_CLIENT_ID: z.string().min(1).optional(),
    GMAIL_CLIENT_SECRET: z.string().min(1).optional(),
    GMAIL_REFRESH_TOKEN: z.string().min(1).optional(),
  },
  required: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
  secrets: ['GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
  create: (settings, context) =>
    new GmailApiEmailSender(
      {
        clientId: settings.GMAIL_CLIENT_ID as string,
        clientSecret: settings.GMAIL_CLIENT_SECRET as string,
        refreshToken: settings.GMAIL_REFRESH_TOKEN as string,
      },
      context,
    ),
};
