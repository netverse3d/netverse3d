import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../../config/app-config';
import { OtpSender } from '../ports/otp-sender';
import { DbTransaction } from '../repositories/principal.repository';
import { OtpPurposeValue, OtpRepository, OtpRow } from '../repositories/otp.repository';

const CODE_SPACE = 1_000_000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly repository: OtpRepository,
    private readonly sender: OtpSender,
  ) {}

  async issue(principalId: string, email: string, purpose: OtpPurposeValue): Promise<void> {
    const latest = await this.repository.findLatest(principalId, purpose);
    const cooldownMs = this.config.otp.resendCooldownSeconds * 1000;
    if (latest && !latest.consumedAt && Date.now() - latest.createdAt.getTime() < cooldownMs) {
      return;
    }

    const code = String(randomInt(CODE_SPACE)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + this.config.otp.ttlMinutes * 60_000);
    await this.repository.replace(principalId, purpose, this.hashCode(code), expiresAt);
    try {
      await this.sender.send({
        email,
        purpose,
        code,
        expiresInMinutes: this.config.otp.ttlMinutes,
        expiresAt,
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
    }
  }

  async matchLatest(
    principalId: string,
    purpose: OtpPurposeValue,
    code: string,
  ): Promise<OtpRow | null> {
    const latest = await this.repository.findLatest(principalId, purpose);
    if (
      !latest ||
      latest.consumedAt ||
      latest.expiresAt <= new Date() ||
      latest.attempts >= this.config.otp.maxAttempts
    ) {
      return null;
    }
    if (timingSafeEqual(Buffer.from(this.hashCode(code)), Buffer.from(latest.codeHash))) {
      return latest;
    }
    await this.repository.countAttempt(latest.id);
    return null;
  }

  consume(otp: OtpRow, transaction: DbTransaction): Promise<boolean> {
    return this.repository.consume(otp.id, new Date(), transaction);
  }

  private hashCode(code: string): string {
    return createHmac('sha256', this.config.otp.hashSecret).update(code).digest('hex');
  }
}
