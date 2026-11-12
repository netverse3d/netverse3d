import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_LOCK_HOLD_MS = 5 * 60_000;

export abstract class LockedJob implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  private timer?: NodeJS.Timeout;

  protected constructor(
    protected readonly prisma: PrismaService,
    private readonly lockId: number,
    private readonly intervalMs: number,
    private readonly enabled: boolean,
  ) {}

  protected abstract work(): Promise<number>;

  onModuleInit(): void {
    if (this.enabled) {
      this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async runOnce(): Promise<number> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
            SELECT pg_try_advisory_xact_lock(${this.lockId}::bigint) AS locked
          `;
          return locked ? this.work() : 0;
        },
        { timeout: MAX_LOCK_HOLD_MS },
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
      return 0;
    }
  }
}
