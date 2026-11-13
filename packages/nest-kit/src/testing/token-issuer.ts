import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';

export const TEST_ISSUER = 'https://issuer.test';
export const TEST_AUDIENCE = 'service-under-test';

export interface TokenClaims {
  subject?: string;
  tenantId?: string;
  roles?: string[];
  clientId?: string;
  permissions?: string[];
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  signedByUnknownKey?: boolean;
}

type KeySource = () => Promise<{ keys: unknown[] }>;

export class TokenIssuer {
  private additionalKeys?: KeySource;

  private constructor(
    private readonly server: Server,
    private readonly privateKey: KeyLike,
    private readonly unknownKey: KeyLike,
    readonly jwksUrl: string,
  ) {}

  static async start(): Promise<TokenIssuer> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const unknown = await generateKeyPair('RS256');
    const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    const server = createServer((_req, res) => {
      void (issuer.additionalKeys?.() ?? Promise.resolve({ keys: [] })).then((extra) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: [jwk, ...extra.keys] }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const issuer = new TokenIssuer(
      server,
      privateKey,
      unknown.privateKey,
      `http://127.0.0.1:${port}/jwks.json`,
    );
    return issuer;
  }

  publishAlso(source: KeySource): void {
    this.additionalKeys = source;
  }

  sign(claims: TokenClaims = {}): Promise<string> {
    return new SignJWT({
      roles: claims.roles ?? [],
      ...(claims.tenantId ? { tenant_id: claims.tenantId } : {}),
      ...(claims.clientId ? { client_id: claims.clientId } : {}),
      ...(claims.permissions ? { permissions: claims.permissions } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(claims.subject ?? 'user-1')
      .setIssuer(claims.issuer ?? TEST_ISSUER)
      .setAudience(claims.audience ?? TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(claims.expiresIn ?? '5m')
      .sign(claims.signedByUnknownKey ? this.unknownKey : this.privateKey);
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise((resolve) => this.server.close(resolve));
  }
}
