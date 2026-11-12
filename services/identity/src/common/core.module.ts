import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '@netverse/nest-kit';
import { JwtAuthGuard } from '@netverse/nest-kit';
import { RolesGuard } from '@netverse/nest-kit';
import { AppLoggerModule } from '@netverse/nest-kit';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { RateLimitModule } from '@netverse/nest-kit';
import { AuditModule } from '@netverse/nest-kit';
import { AuditInterceptor } from '@netverse/nest-kit';
import { SessionStateGuard } from '../modules/identity/guards/session-state.guard';
import { IdentityModule } from '../modules/identity/identity.module';
import { ConfigModule } from '../config/config.module';
import { GlobalExceptionFilter } from '@netverse/nest-kit';
import { ResponseEnvelopeInterceptor } from '@netverse/nest-kit';
import { TimeoutInterceptor } from '@netverse/nest-kit';
import { createValidationPipe } from '@netverse/nest-kit';

@Module({
  imports: [
    ConfigModule,
    AppLoggerModule,
    PrismaModule,
    RateLimitModule,
    AuthModule,
    AuditModule,
    IdentityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: SessionStateGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class CoreModule {}
