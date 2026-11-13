import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { TENANT_ADMIN_ROLE } from '@netverse/nest-kit';
import {
  BrandingEntryResponseDto,
  BrandingResponseDto,
  PutBrandingEntryDto,
} from '../dto/branding.dto';
import { BrandingService } from '../services/branding.service';

const brandingKeyParam = ({ params }: AuditResourceInput) => params.key;

@ApiTags('branding')
@Roles(TENANT_ADMIN_ROLE)
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @ApiOperation({ summary: 'List the branding values of the tenant' })
  @ApiEnvelope(BrandingResponseDto)
  list(@CurrentActor() actor: Actor): Promise<BrandingResponseDto> {
    return this.branding.list(actor);
  }

  @Put(':key')
  @Audit({ action: 'branding.put', resourceType: 'branding', resourceId: brandingKeyParam })
  @ApiOperation({ summary: 'Set a branding value, available to templates as brand.<key>' })
  @ApiEnvelope(BrandingEntryResponseDto)
  put(
    @Param('key') key: string,
    @Body() dto: PutBrandingEntryDto,
    @CurrentActor() actor: Actor,
  ): Promise<BrandingEntryResponseDto> {
    return this.branding.put(key, dto, actor);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'branding.delete', resourceType: 'branding', resourceId: brandingKeyParam })
  @ApiOperation({ summary: 'Remove a branding value' })
  @ApiNoContentResponse()
  remove(@Param('key') key: string, @CurrentActor() actor: Actor): Promise<void> {
    return this.branding.remove(key, actor);
  }
}
