import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { KitConfig } from '../../config/kit-config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [KitConfig],
      useFactory: (config: KitConfig) => ({
        throttlers: [{ name: 'default', ttl: config.rateLimit.ttlMs, limit: config.rateLimit.max }],
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
