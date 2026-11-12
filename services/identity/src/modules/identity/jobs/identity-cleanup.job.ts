import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { LockedJob } from '@netverse/nest-kit';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { KeysService } from '../../keys/services/keys.service';
import { OtpRepository } from '../repositories/otp.repository';
import { SessionRepository } from '../repositories/session.repository';

const CLEANUP_LOCK_ID = 7202;

@Injectable()
export class IdentityCleanupJob extends LockedJob {
  constructor(
    prisma: PrismaService,
    config: AppConfig,
    private readonly sessions: SessionRepository,
    private readonly otps: OtpRepository,
    private readonly keys: KeysService,
  ) {
    super(prisma, CLEANUP_LOCK_ID, config.jobs.cleanupIntervalSeconds * 1000, config.jobs.enabled);
  }

  protected async work(): Promise<number> {
    const now = new Date();
    const [sessions, otps, keys] = await Promise.all([
      this.sessions.deleteExpired(now),
      this.otps.deleteExpired(now),
      this.keys.retireExpired(),
    ]);
    return sessions + otps + keys;
  }
}
