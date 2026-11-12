import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../common/context/request-context';
import { CurrentActor } from '../../../common/decorators/current-actor.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PageResponseDto } from '../../../common/pagination/page-response.dto';
import { ApiEnvelope, ApiPagedEnvelope } from '../../../common/swagger/api-envelope.decorators';
import { Audit, AuditResourceInput } from '../../audit/audit.decorator';
import { MEDIA_MANAGER_ROLE } from '../domain/media-access';
import { IssueDownloadUrlDto } from '../dto/issue-download-url.dto';
import { IssueUploadUrlDto } from '../dto/issue-upload-url.dto';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import {
  DownloadUrlResponseDto,
  MediaResponseDto,
  PromoteBatchResponseDto,
  UploadUrlResponseDto,
} from '../dto/media-response.dto';
import { ModerateMediaDto } from '../dto/moderate-media.dto';
import { PromoteBatchDto, PromoteMediaDto } from '../dto/promote-media.dto';
import { MediaService } from '../services/media.service';

const mediaIdParam = ({ params }: AuditResourceInput) => params.id;
const issuedMediaId = ({ result }: AuditResourceInput) =>
  (result as UploadUrlResponseDto | undefined)?.mediaId;

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('issue-upload-url')
  @Audit({ action: 'media.upload_issued', resourceType: 'media', resourceId: issuedMediaId })
  @ApiOperation({ summary: 'Create a pending media record and issue a presigned upload URL' })
  @ApiHeader({ name: 'idempotency-key', required: false })
  @ApiEnvelope(UploadUrlResponseDto, HttpStatus.CREATED)
  issueUploadUrl(
    @Body() dto: IssueUploadUrlDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentActor() actor: Actor,
  ): Promise<UploadUrlResponseDto> {
    return this.media.issueUploadUrl(dto, idempotencyKey, actor);
  }

  @Post('promote-batch')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'media.promote_batch', resourceType: 'media' })
  @ApiOperation({ summary: 'Promote up to 50 temporary media objects' })
  @ApiEnvelope(PromoteBatchResponseDto)
  promoteBatch(
    @Body() dto: PromoteBatchDto,
    @CurrentActor() actor: Actor,
  ): Promise<PromoteBatchResponseDto> {
    return this.media.promoteBatch(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List permanent media visible to the caller' })
  @ApiPagedEnvelope(MediaResponseDto)
  list(
    @Query() query: ListMediaQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<MediaResponseDto>> {
    return this.media.list(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one media object' })
  @ApiEnvelope(MediaResponseDto)
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<MediaResponseDto> {
    return this.media.get(id, actor);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'media.complete', resourceType: 'media', resourceId: mediaIdParam })
  @ApiOperation({ summary: 'Verify the uploaded object and activate the media' })
  @ApiEnvelope(MediaResponseDto)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<MediaResponseDto> {
    return this.media.complete(id, actor);
  }

  @Post(':id/issue-download-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a presigned download URL' })
  @ApiEnvelope(DownloadUrlResponseDto)
  issueDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueDownloadUrlDto,
    @CurrentActor() actor: Actor,
  ): Promise<DownloadUrlResponseDto> {
    return this.media.issueDownloadUrl(id, dto, actor);
  }

  @Post(':id/promote')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'media.promote', resourceType: 'media', resourceId: mediaIdParam })
  @ApiOperation({ summary: 'Turn temporary media into permanent media' })
  @ApiEnvelope(MediaResponseDto)
  promote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PromoteMediaDto,
    @CurrentActor() actor: Actor,
  ): Promise<MediaResponseDto> {
    return this.media.promote(id, dto, actor);
  }

  @Post(':id/moderation')
  @HttpCode(HttpStatus.OK)
  @Roles(MEDIA_MANAGER_ROLE)
  @Audit({ action: 'media.moderate', resourceType: 'media', resourceId: mediaIdParam })
  @ApiOperation({ summary: 'Record a moderation decision for user content' })
  @ApiEnvelope(MediaResponseDto)
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateMediaDto,
    @CurrentActor() actor: Actor,
  ): Promise<MediaResponseDto> {
    return this.media.moderate(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'media.delete', resourceType: 'media', resourceId: mediaIdParam })
  @ApiOperation({ summary: 'Soft-delete a media object' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<void> {
    return this.media.remove(id, actor);
  }
}
