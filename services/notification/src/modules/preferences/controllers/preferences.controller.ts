import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { OptOutKeyDto, OptOutListResponseDto, OptOutResponseDto } from '../dto/preferences.dto';
import { PreferencesService } from '../services/preferences.service';

@ApiTags('preferences')
@Controller('preferences/opt-outs')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'List the opt-outs of the signed-in user' })
  @ApiEnvelope(OptOutListResponseDto)
  list(@CurrentActor() actor: Actor): Promise<OptOutListResponseDto> {
    return this.preferences.listOptOuts(actor);
  }

  @Put()
  @Audit({ action: 'preference.opt_out', resourceType: 'preference' })
  @ApiOperation({ summary: 'Opt the signed-in user out of one channel and event' })
  @ApiEnvelope(OptOutResponseDto)
  optOut(@Body() dto: OptOutKeyDto, @CurrentActor() actor: Actor): Promise<OptOutResponseDto> {
    return this.preferences.optOut(dto, actor);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'preference.opt_in', resourceType: 'preference' })
  @ApiOperation({ summary: 'Remove an opt-out of the signed-in user' })
  @ApiNoContentResponse()
  optIn(@Query() key: OptOutKeyDto, @CurrentActor() actor: Actor): Promise<void> {
    return this.preferences.optIn(key, actor);
  }
}
