import MailComposer from 'nodemailer/lib/mail-composer';
import { z } from 'zod';
import { ChannelSender, OutboundMessage, SendReceipt } from '../ports/channel-sender';
import {
  assertAccepted,
  EmailProvider,
  EmailSenderContext,
  formatSender,
} from '../ports/email-provider';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const PERMANENT_STATUSES = new Set([400]);
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 3_000;

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

export class GmailApiEmailSender extends ChannelSender {
  private token: AccessToken | null = null;
  private refreshing: Promise<AccessToken> | null = null;

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
    const accessToken = await this.accessToken();
    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ raw: raw.toString('base64url') }),
      signal: AbortSignal.timeout(this.context.timeoutMs),
    });
    if (response.status === 401 && this.token?.value === accessToken) {
      this.token = null;
    }
    assertAccepted(response, PERMANENT_STATUSES, 'Gmail');
    const { id } = (await response.json()) as { id?: string };
    return { providerMessageId: id };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return this.token.value;
    }
    this.refreshing ??= this.refresh().then(
      (token) => {
        this.token = token;
        this.refreshing = null;
        return token;
      },
      (error: unknown) => {
        this.refreshing = null;
        throw error;
      },
    );
    return (await this.refreshing).value;
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
      throw new Error(`Google did not issue an access token, it answered ${response.status}`);
    }
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new Error('Google answered without an access token');
    }
    const lifetimeSeconds =
      typeof body.expires_in === 'number' && body.expires_in > 0
        ? body.expires_in
        : DEFAULT_TOKEN_LIFETIME_SECONDS;
    return { value: body.access_token, expiresAt: Date.now() + lifetimeSeconds * 1000 };
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
