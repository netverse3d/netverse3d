import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from '../../config/app-config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: config.rateLimit.ttlMs, limit: config.rateLimit.max }],
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
