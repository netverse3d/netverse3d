import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelope,
  ApiPagedEnvelope,
  Audit,
  AuditResourceInput,
  PageResponseDto,
  PaginationQueryDto,
  PLATFORM_ADMIN_ROLE,
  Roles,
} from '@netverse/nest-kit';
import {
  CreatedServiceClientDto,
  CreateServiceClientDto,
  RotatedSecretDto,
  ServiceClientDto,
} from '../dto/service-client.dto';
import { ServiceClientService } from '../services/service-client.service';

const RESOURCE_TYPE = 'service-client';
const clientIdParam = ({ params }: AuditResourceInput) => params.id;
const createdClientId = ({ result }: AuditResourceInput) =>
  (result as ServiceClientDto | undefined)?.id;

@ApiTags('service-clients')
@Roles(PLATFORM_ADMIN_ROLE)
@Controller('admin/service-clients')
export class ServiceClientsAdminController {
  constructor(private readonly clients: ServiceClientService) {}

  @Post()
  @Audit({
    action: 'service-client.create',
    resourceType: RESOURCE_TYPE,
    resourceId: createdClientId,
  })
  @ApiOperation({ summary: 'Create a service account; the secret is shown once' })
  @ApiEnvelope(CreatedServiceClientDto, HttpStatus.CREATED)
  create(@Body() dto: CreateServiceClientDto): Promise<CreatedServiceClientDto> {
    return this.clients.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List service accounts' })
  @ApiPagedEnvelope(ServiceClientDto)
  list(@Query() query: PaginationQueryDto): Promise<PageResponseDto<ServiceClientDto>> {
    return this.clients.list(query);
  }

  @Post(':id/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: 'service-client.rotate-secret',
    resourceType: RESOURCE_TYPE,
    resourceId: clientIdParam,
  })
  @ApiOperation({ summary: 'Replace the secret; the old one stops working at once' })
  @ApiEnvelope(RotatedSecretDto)
  rotateSecret(@Param('id', ParseUUIDPipe) id: string): Promise<RotatedSecretDto> {
    return this.clients.rotateSecret(id);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: 'service-client.revoke',
    resourceType: RESOURCE_TYPE,
    resourceId: clientIdParam,
  })
  @ApiOperation({ summary: 'Revoke a service account for good' })
  @ApiNoContentResponse()
  revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clients.revoke(id);
  }
}
