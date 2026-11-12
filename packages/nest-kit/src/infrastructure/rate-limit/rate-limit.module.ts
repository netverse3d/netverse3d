import { ExecutionContext, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { KitConfig } from '../../config/kit-config';
import { AUTH_THROTTLE_METADATA } from './auth-throttle.decorator';

function isNotAuthRoute(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_THROTTLE_METADATA, context.getHandler()) !== true;
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [KitConfig],
      useFactory: (config: KitConfig) => ({
        throttlers: [
          { name: 'default', ttl: config.rateLimit.ttlMs, limit: config.rateLimit.max },
          ...(config.rateLimit.authMax === undefined
            ? []
            : [
                {
                  name: 'auth',
                  ttl: config.rateLimit.ttlMs,
                  limit: config.rateLimit.authMax,
                  skipIf: isNotAuthRoute,
                },
              ]),
        ],
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
