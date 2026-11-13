import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { TENANT_ADMIN_ROLE } from '@netverse/nest-kit';
import {
  CreateTemplateDto,
  TemplateQueryDto,
  UpdateTemplateDto,
} from '../dto/template-request.dto';
import { TemplateResponseDto } from '../dto/template-response.dto';
import { TemplatesService } from '../services/templates.service';

const createdTemplateId = ({ result }: AuditResourceInput) =>
  (result as TemplateResponseDto | undefined)?.id;
const templateIdParam = ({ params }: AuditResourceInput) => params.id;

@ApiTags('templates')
@Roles(TENANT_ADMIN_ROLE)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Post()
  @Audit({ action: 'template.create', resourceType: 'template', resourceId: createdTemplateId })
  @ApiOperation({ summary: 'Create a template for an event, channel and locale' })
  @ApiEnvelope(TemplateResponseDto, HttpStatus.CREATED)
  create(
    @Body() dto: CreateTemplateDto,
    @CurrentActor() actor: Actor,
  ): Promise<TemplateResponseDto> {
    return this.templates.create(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List templates' })
  @ApiPagedEnvelope(TemplateResponseDto)
  list(
    @Query() query: TemplateQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<TemplateResponseDto>> {
    return this.templates.list(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one template' })
  @ApiEnvelope(TemplateResponseDto)
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<TemplateResponseDto> {
    return this.templates.get(id, actor);
  }

  @Patch(':id')
  @Audit({ action: 'template.update', resourceType: 'template', resourceId: templateIdParam })
  @ApiOperation({ summary: 'Update a template and bump its version' })
  @ApiEnvelope(TemplateResponseDto)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentActor() actor: Actor,
  ): Promise<TemplateResponseDto> {
    return this.templates.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'template.delete', resourceType: 'template', resourceId: templateIdParam })
  @ApiOperation({ summary: 'Delete a template' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<void> {
    return this.templates.remove(id, actor);
  }
}
