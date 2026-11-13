import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { TENANT_ADMIN_ROLE } from '@netverse/nest-kit';
import { BlockAddressDto, BlockedAddressResponseDto } from '../dto/preferences.dto';
import { PreferencesService } from '../services/preferences.service';

const createdBlockId = ({ result }: AuditResourceInput) =>
  (result as BlockedAddressResponseDto | undefined)?.id;
const blockIdParam = ({ params }: AuditResourceInput) => params.id;

@ApiTags('blocked-addresses')
@Roles(TENANT_ADMIN_ROLE)
@Controller('blocked-addresses')
export class BlockedAddressesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Post()
  @Audit({
    action: 'blocked_address.create',
    resourceType: 'blocked_address',
    resourceId: createdBlockId,
  })
  @ApiOperation({ summary: 'Block an address for the tenant' })
  @ApiEnvelope(BlockedAddressResponseDto, HttpStatus.CREATED)
  block(
    @Body() dto: BlockAddressDto,
    @CurrentActor() actor: Actor,
  ): Promise<BlockedAddressResponseDto> {
    return this.preferences.block(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List the blocked addresses of the tenant' })
  @ApiPagedEnvelope(BlockedAddressResponseDto)
  list(
    @Query() query: PaginationQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<BlockedAddressResponseDto>> {
    return this.preferences.listBlocked(query, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: 'blocked_address.delete',
    resourceType: 'blocked_address',
    resourceId: blockIdParam,
  })
  @ApiOperation({ summary: 'Unblock an address' })
  @ApiNoContentResponse()
  unblock(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<void> {
    return this.preferences.unblock(id, actor);
  }
}
