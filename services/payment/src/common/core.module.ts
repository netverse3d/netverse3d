import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  AppLoggerModule,
  AuditInterceptor,
  AuthModule,
  createValidationPipe,
  GlobalExceptionFilter,
  JwtAuthGuard,
  RateLimitModule,
  ResponseEnvelopeInterceptor,
  RolesGuard,
  TimeoutInterceptor,
} from '@netverse/nest-kit';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { ConfigModule } from '../config/config.module';
import { ApiKeyAuthModule } from '../modules/auth/auth.module';
import { AuditModule } from '../modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    AppLoggerModule,
    PrismaModule,
    RateLimitModule,
    AuthModule,
    ApiKeyAuthModule,
    AuditModule,
  ],
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
