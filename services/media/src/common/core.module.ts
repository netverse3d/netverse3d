import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { JwtAuthGuard } from '../infrastructure/auth/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/roles.guard';
import { AppLoggerModule } from '../infrastructure/logger/app-logger.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { RateLimitModule } from '../infrastructure/rate-limit/rate-limit.module';
import { AuditModule } from '../modules/audit/audit.module';
import { AuditInterceptor } from '../modules/audit/interceptors/audit.interceptor';
import { ConfigModule } from '../config/config.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { createValidationPipe } from './validation/create-validation-pipe';

@Module({
  imports: [ConfigModule, AppLoggerModule, PrismaModule, RateLimitModule, AuthModule, AuditModule],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class CoreModule {}
