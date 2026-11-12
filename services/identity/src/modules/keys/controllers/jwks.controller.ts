import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@netverse/nest-kit';
import { RawResponse } from '@netverse/nest-kit';
import { KeysService } from '../services/keys.service';

@ApiTags('keys')
@SkipThrottle()
@RawResponse()
@Controller({ version: VERSION_NEUTRAL })
export class JwksController {
  constructor(private readonly keys: KeysService) {}

  @Get('.well-known/jwks.json')
  @Public()
  @ApiOperation({ summary: 'Public keys used to verify issued tokens' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'object' } } } },
  })
  publicKeys(): Promise<{ keys: unknown[] }> {
    return this.keys.publicKeySet();
  }
}
