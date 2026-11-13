import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { exportJWK, exportPKCS8, generateKeyPair, importPKCS8, SignJWT } from 'jose';
import { AppConfig } from '../../../config/app-config';
import { openSecret, sealSecret } from '../domain/secret-box';
import {
  NewSigningKey,
  SigningKeyRepository,
  SigningKeyRow,
} from '../repositories/signing-key.repository';

const SIGNING_ALGORITHM = 'RS256';

interface TokenScope {
  audience?: string;
  ttlSeconds?: number;
}

@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly repository: SigningKeyRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    if (await this.repository.findActive()) {
      return;
    }
    const inserted = await this.repository.insertIfNoActive(await this.generateKey());
    if (inserted) {
      this.logger.log('created the first signing key');
    }
  }

  async publicKeySet(): Promise<{ keys: unknown[] }> {
    const rows = await this.repository.findPublished();
    return { keys: rows.map((row) => row.publicJwk) };
  }

  async sign(
    claims: Record<string, unknown>,
    subject: string,
    scope: TokenScope = {},
  ): Promise<string> {
    const key = await this.repository.findActive();
    if (!key) {
      throw new Error('no active signing key');
    }
    const privateKey = await importPKCS8(
      openSecret(key.privateKeyEnc, this.config.tokens.keyEncryptionSecret),
      SIGNING_ALGORITHM,
    );
    return new SignJWT(claims)
      .setProtectedHeader({ alg: SIGNING_ALGORITHM, kid: key.kid })
      .setSubject(subject)
      .setIssuer(this.config.auth.issuer)
      .setAudience(scope.audience ?? this.config.tokens.audiences)
      .setIssuedAt()
      .setExpirationTime(`${scope.ttlSeconds ?? this.config.tokens.accessTtlSeconds}s`)
      .sign(privateKey);
  }

  async rotate(): Promise<{ activeKid: string; retiringKid: string | null }> {
    const key = await this.generateKey();
    const retiringKid = await this.repository.replaceActive(key);
    return { activeKid: key.kid, retiringKid };
  }

  list(): Promise<SigningKeyRow[]> {
    return this.repository.findAll();
  }

  async retireExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.tokens.keyRetireGraceHours * 3_600_000);
    return this.repository.revokeRetiredBefore(cutoff);
  }

  private async generateKey(): Promise<NewSigningKey> {
    const { publicKey, privateKey } = await generateKeyPair(SIGNING_ALGORITHM, {
      extractable: true,
    });
    const kid = randomUUID();
    return {
      kid,
      status: 'ACTIVE',
      publicJwk: { ...(await exportJWK(publicKey)), kid, alg: SIGNING_ALGORITHM, use: 'sig' },
      privateKeyEnc: sealSecret(
        await exportPKCS8(privateKey),
        this.config.tokens.keyEncryptionSecret,
      ),
    };
  }
}
