import { createHmac } from 'node:crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';

export const GOOGLE_CLIENT = 'google-client';
export const APPLE_CLIENT = 'apple-client';
export const GOOGLE_ISSUER = 'https://google.test';
export const APPLE_ISSUER = 'https://apple.test';
export const FACEBOOK_APP = 'facebook-app';
export const FACEBOOK_SECRET = 'facebook-secret';
export const ZALO_SECRET = 'zalo-secret';
export const GITHUB_CLIENT = 'github-client';
export const GITHUB_SECRET = 'github-secret';

export interface FakeProfile {
  id: string;
  email?: string;
  verified?: boolean;
  name?: string;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
  });
}

export class FakeSocialProviders {
  readonly facebookTokens = new Map<string, FakeProfile & { appId: string }>();
  readonly zaloTokens = new Map<string, FakeProfile>();
  readonly githubCodes = new Map<string, FakeProfile>();
  failing = false;

  private constructor(
    private readonly server: Server,
    private readonly key: KeyLike,
    readonly baseUrl: string,
  ) {}

  static async start(): Promise<FakeSocialProviders> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk: JWK = {
      ...(await exportJWK(publicKey)),
      kid: 'social-key',
      alg: 'RS256',
      use: 'sig',
    };
    const server = createServer(
      (request, response) => void instance.handle(request, response, jwk),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    server.unref();
    const { port } = server.address() as AddressInfo;
    const instance = new FakeSocialProviders(server, privateKey, `http://127.0.0.1:${port}`);
    return instance;
  }

  idToken(issuer: string, audience: string, profile: FakeProfile): Promise<string> {
    return new SignJWT({
      email: profile.email,
      email_verified: profile.verified ?? true,
      name: profile.name,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'social-key' })
      .setSubject(profile.id)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.key);
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise((resolve) => this.server.close(resolve));
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
    jwk: JWK,
  ): Promise<void> {
    if (this.failing) {
      response.statusCode = 503;
      response.end('{}');
      return;
    }
    const url = new URL(request.url ?? '/', this.baseUrl);
    const authorization = request.headers.authorization?.replace('Bearer ', '') ?? '';

    switch (url.pathname) {
      case '/jwks':
        return this.json(response, 200, { keys: [jwk] });
      case '/facebook/debug_token': {
        const profile = this.facebookTokens.get(url.searchParams.get('input_token') ?? '');
        const appAuthorized =
          url.searchParams.get('access_token') === `${FACEBOOK_APP}|${FACEBOOK_SECRET}`;
        return this.json(response, 200, {
          data:
            appAuthorized && profile
              ? { is_valid: true, app_id: profile.appId, user_id: profile.id }
              : { is_valid: false },
        });
      }
      case '/facebook/me': {
        const profile = this.facebookTokens.get(url.searchParams.get('access_token') ?? '');
        return this.json(
          response,
          profile ? 200 : 400,
          profile ? { id: profile.id, name: profile.name, email: profile.email } : {},
        );
      }
      case '/zalo/me': {
        const token = String(request.headers.access_token ?? '');
        const proof = createHmac('sha256', ZALO_SECRET).update(token).digest('hex');
        const profile = this.zaloTokens.get(token);
        if (request.headers.appsecret_proof !== proof || !profile) {
          return this.json(response, 200, { error: 452 });
        }
        return this.json(response, 200, { id: profile.id, name: profile.name });
      }
      case '/github/token': {
        const { code, client_secret: secret } = JSON.parse(await readBody(request)) as {
          code: string;
          client_secret: string;
        };
        return this.json(
          response,
          200,
          this.githubCodes.has(code) && secret === GITHUB_SECRET
            ? { access_token: code }
            : { error: 'bad_verification_code' },
        );
      }
      case '/github/user': {
        const profile = this.githubCodes.get(authorization);
        return this.json(
          response,
          profile ? 200 : 401,
          profile ? { id: Number(profile.id), name: profile.name, login: 'octo' } : {},
        );
      }
      case '/github/user/emails': {
        const profile = this.githubCodes.get(authorization);
        return this.json(
          response,
          200,
          profile?.email
            ? [{ email: profile.email, primary: true, verified: profile.verified ?? true }]
            : [],
        );
      }
      default:
        return this.json(response, 404, {});
    }
  }
}
