import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './common/core.module';
import { ApiKeyAuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule, HealthProbe } from '@netverse/nest-kit';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProviderAccountsModule } from './modules/provider-accounts/provider-accounts.module';
import { ProviderWebhooksModule } from './modules/provider-webhooks/provider-webhooks.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { TenantApiKeysModule } from './modules/tenant-api-keys/tenant-api-keys.module';
import { TenantWebhooksModule } from './modules/tenant-webhooks/tenant-webhooks.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';

const healthProbes = (prisma: PrismaService): HealthProbe[] => [
  () => prisma.$queryRaw`SELECT 1`.then(() => undefined),
];

@Module({
  imports: [
    CoreModule,
    ScheduleModule.forRoot(),
    HealthModule.withProbes({
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: healthProbes,
    }),
    ApiKeyAuthModule,
    TenantsModule,
    TenantApiKeysModule,
    TenantWebhooksModule,
    ProviderAccountsModule,
    CustomersModule,
    IdempotencyModule,
    ProvidersModule,
    PaymentsModule,
    ProviderWebhooksModule,
    RefundsModule,
    OutboxModule,
    ReconciliationModule,
  ],
})
export class AppModule {}
