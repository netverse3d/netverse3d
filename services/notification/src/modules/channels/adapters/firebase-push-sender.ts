import { importPKCS8, SignJWT } from 'jose';
import { AppConfig } from '../../../config/app-config';
import {
  assertAccepted,
  ChannelSender,
  OutboundMessage,
  ProviderConfigurationError,
  SendReceipt,
} from '../ports/channel-sender';
import { AccessToken, AccessTokenCache, accessTokenFrom } from './access-token-cache';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const PERMANENT_STATUSES = new Set([400, 404]);
const CREDENTIAL_STATUSES = new Set([401]);
const REFUSED_KEY_STATUSES = new Set([400, 401]);
const PROVIDER = 'Push provider';

export class FirebasePushSender extends ChannelSender {
  private readonly tokens = new AccessTokenCache(() => this.issueToken());

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: OutboundMessage): Promise<SendReceipt> {
    const projectId = this.config.push.firebaseProjectId as string;
    const accessToken = await this.tokens.get();
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
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
    if (response.status === 401) {
      this.tokens.discard(accessToken);
    }
    assertAccepted(response, PERMANENT_STATUSES, PROVIDER, CREDENTIAL_STATUSES);
    const { name } = (await response.json()) as { name?: string };
    return { providerMessageId: name };
  }

  private async issueToken(): Promise<AccessToken> {
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
      const message = `${PROVIDER} token request answered ${response.status}`;
      throw REFUSED_KEY_STATUSES.has(response.status)
        ? new ProviderConfigurationError(message)
        : new Error(message);
    }
    return accessTokenFrom((await response.json()) as { access_token?: string });
  }
}
