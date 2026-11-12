import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const PORT = Number(process.env.DEV_ISSUER_PORT ?? 4000);
const HOST = process.env.DEV_ISSUER_HOST ?? '127.0.0.1';
const ISSUER = process.env.AUTH_ISSUER ?? `http://localhost:${PORT}`;
const AUDIENCE = process.env.AUTH_AUDIENCE ?? 'media';
const KEY_ID = 'dev-key';

async function startDevIssuer(): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', ISSUER);
    res.setHeader('content-type', 'application/json');

    if (url.pathname === '/.well-known/jwks.json') {
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname === '/token') {
      const tenant = url.searchParams.get('tenant');
      const token = await new SignJWT({
        roles: (url.searchParams.get('roles') ?? '').split(',').filter(Boolean),
        ...(tenant ? { tenant_id: tenant } : {}),
      })
        .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
        .setSubject(url.searchParams.get('sub') ?? 'dev-user')
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
      res.end(JSON.stringify({ token }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });

  server.listen(PORT, HOST);
}

void startDevIssuer();
