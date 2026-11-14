import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { IS_PUBLIC_METADATA } from '../../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';

export const TENANT_API_KEY_SECURITY = 'tenant-api-key';

export const ApiKeyAuth = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_METADATA, true),
    UseGuards(ApiKeyGuard),
    ApiSecurity(TENANT_API_KEY_SECURITY),
  );
