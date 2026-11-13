import { importPKCS8, SignJWT } from 'jose';
import { AppConfig } from '../../../config/app-config';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import {
  ChannelSender,
  OutboundMessage,
  PermanentSendError,
  SendReceipt,
} from '../ports/channel-sender';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const PERMANENT_STATUSES = new Set([400, 404]);

interface CachedToken {
  value: string;
  expiresAt: number;
}

export class FirebasePushSender extends ChannelSender {
  private cachedToken?: CachedToken;

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const projectId = this.config.push.firebaseProjectId as string;
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${await this.accessToken()}`,
        },
        body: JSON.stringify({
          message: {
            token: message.destination,
            notification: { title: message.subject, body: message.body },
          },
        }),
        signal: AbortSignal.timeout(this.config.providers.timeoutMs),
      },
    );
    if (PERMANENT_STATUSES.has(response.status)) {
      throw new PermanentSendError(
        DeliveryReason.PROVIDER_REJECTED,
        `Push provider rejected the message with status ${response.status}`,
      );
    }
    if (!response.ok) {
      throw new Error(`Push provider answered ${response.status}`);
    }
    const { name } = (await response.json()) as { name?: string };
    return { providerMessageId: name };
  }

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return this.cachedToken.value;
    }
    const clientEmail = this.config.push.firebaseClientEmail as string;
    const privateKey = (this.config.push.firebasePrivateKey as string).replace(/\\n/g, '\n');
    const assertion = await new SignJWT({ scope: MESSAGING_SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(clientEmail)
      .setSubject(clientEmail)
      .setAudience(TOKEN_URL)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(await importPKCS8(privateKey, 'RS256'));
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(this.config.providers.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Push provider token request answered ${response.status}`);
    }
    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }
}
