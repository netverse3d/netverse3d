import { Module } from '@nestjs/common';
import { ProviderCredentialCryptoService } from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { TenantWebhookAdminController } from './controllers/tenant-webhook-admin.controller';
import { TenantWebhookRepository } from './repositories/tenant-webhook.repository';
import { TenantWebhookService } from './services/tenant-webhook.service';

@Module({
  controllers: [TenantWebhookAdminController],
  providers: [ProviderCredentialCryptoService, TenantWebhookRepository, TenantWebhookService],
  exports: [ProviderCredentialCryptoService, TenantWebhookRepository, TenantWebhookService],
})
export class TenantWebhooksModule {}
