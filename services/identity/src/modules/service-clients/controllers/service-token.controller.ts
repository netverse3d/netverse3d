import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, AuthThrottle, Public } from '@netverse/nest-kit';
import { ServiceTokenDto, ServiceTokenRequestDto } from '../dto/service-client.dto';
import { ServiceClientService } from '../services/service-client.service';

@ApiTags('auth')
@Controller('auth')
export class ServiceTokenController {
  constructor(private readonly clients: ServiceClientService) {}

  @Post('service-token')
  @HttpCode(HttpStatus.OK)
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Exchange a service account id and secret for a short-lived token' })
  @ApiEnvelope(ServiceTokenDto)
  issue(@Body() dto: ServiceTokenRequestDto): Promise<ServiceTokenDto> {
    return this.clients.issueToken(dto);
  }
}
