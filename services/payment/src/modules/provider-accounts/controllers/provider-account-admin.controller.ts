import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromParam, resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { CreateProviderAccountDto } from '../dto/create-provider-account.dto';
import { ProviderAccountResponseDto } from '../dto/provider-account-response.dto';
import {
  ReplaceProviderCredentialsDto,
  UpdateProviderAccountDto,
} from '../dto/update-provider-account.dto';
import { ProviderAccountService } from '../services/provider-account.service';

@ApiTags('Provider Accounts')
@Roles('platform_admin')
@Controller('internal/tenants/:tenantId/provider-accounts')
export class ProviderAccountAdminController {
  constructor(private readonly service: ProviderAccountService) {}

  @Get()
  @ApiOperation({ summary: 'List provider accounts of a tenant; credentials are never returned' })
  @ApiPagedEnvelope(ProviderAccountResponseDto)
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Query() query: PaginationQueryDto) {
    return this.service.list(tenantId, query);
  }

  @Post()
  @Audit({
    action: 'provider_account.create',
    resourceType: 'provider_account',
    resourceId: resourceIdFromResult,
  })
  @ApiOperation({
    summary: 'Create a provider account; credentials are encrypted and never returned',
  })
  @ApiBody({ type: CreateProviderAccountDto })
  @ApiEnvelope(ProviderAccountResponseDto, HttpStatus.CREATED)
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateProviderAccountDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(':accountId')
  @Audit({
    action: 'provider_account.update',
    resourceType: 'provider_account',
    resourceId: resourceIdFromParam('accountId'),
  })
  @ApiOperation({ summary: 'Update the status, label or configuration of a provider account' })
  @ApiBody({ type: UpdateProviderAccountDto })
  @ApiEnvelope(ProviderAccountResponseDto)
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateProviderAccountDto,
  ) {
    return this.service.update(tenantId, accountId, dto);
  }

  @Put(':accountId/credentials')
  @Audit({
    action: 'provider_account.replace_credentials',
    resourceType: 'provider_account',
    resourceId: resourceIdFromParam('accountId'),
  })
  @ApiOperation({ summary: 'Replace credentials (re-encrypted, never returned)' })
  @ApiBody({ type: ReplaceProviderCredentialsDto })
  @ApiEnvelope(ProviderAccountResponseDto)
  replaceCredentials(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ReplaceProviderCredentialsDto,
  ) {
    return this.service.replaceCredentials(tenantId, accountId, dto);
  }

  @Post(':accountId/encrypt-credentials')
  @HttpCode(HttpStatus.CREATED)
  @Audit({
    action: 'provider_account.encrypt_credentials',
    resourceType: 'provider_account',
    resourceId: resourceIdFromParam('accountId'),
  })
  @ApiOperation({
    summary: 'Backfill: encrypt legacy plaintext credentials and remove the plaintext copy',
  })
  @ApiEnvelope(ProviderAccountResponseDto, HttpStatus.CREATED)
  encryptCredentials(@Param('tenantId') tenantId: string, @Param('accountId') accountId: string) {
    return this.service.encryptExistingCredentials(tenantId, accountId);
  }
}
