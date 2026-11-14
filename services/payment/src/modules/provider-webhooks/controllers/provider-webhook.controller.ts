import { Body, Controller, Get, HttpCode, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '@app/common/decorators/public.decorator';
import { ApiEnvelope } from '@app/common/swagger/api-envelope.decorators';
import { ProviderWebhookRequest } from '@app/modules/providers/contracts/payment-provider.contract';
import { WebhookIngestResponseDto } from '../dto/webhook-ingest-response.dto';
import { ProviderWebhookService } from '../services/provider-webhook.service';

@ApiTags('Provider Webhooks')
@SkipThrottle()
@Controller('webhooks')
export class ProviderWebhookController {
  constructor(private readonly service: ProviderWebhookService) {}

  @Post(':providerCode')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ingest a provider webhook (POST); the signature is verified before any write',
  })
  @ApiEnvelope(WebhookIngestResponseDto)
  ingestPost(
    @Param('providerCode') providerCode: string,
    @Body() payload: unknown,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.service.handle(providerCode, this.toProviderRequest(request, payload, null));
  }

  @Post(':providerCode/:accountRef')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ingest a provider webhook (POST) routed by the merchant account in the path (payOS clientId, VietQR account number)',
  })
  @ApiEnvelope(WebhookIngestResponseDto)
  ingestPostForAccount(
    @Param('providerCode') providerCode: string,
    @Param('accountRef') accountRef: string,
    @Body() payload: unknown,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.service.handle(providerCode, this.toProviderRequest(request, payload, accountRef));
  }

  @Get(':providerCode')
  @Public()
  @ApiOperation({
    summary: 'Ingest a provider IPN (GET query string); the checksum is verified before any write',
  })
  @ApiEnvelope(WebhookIngestResponseDto)
  ingestGet(@Param('providerCode') providerCode: string, @Req() request: Request) {
    return this.service.handle(providerCode, this.toProviderRequest(request, undefined, null));
  }

  @Get(':providerCode/:accountRef')
  @Public()
  @ApiOperation({
    summary: 'Ingest a provider IPN (GET) routed by the merchant account in the path',
  })
  @ApiEnvelope(WebhookIngestResponseDto)
  ingestGetForAccount(
    @Param('providerCode') providerCode: string,
    @Param('accountRef') accountRef: string,
    @Req() request: Request,
  ) {
    return this.service.handle(
      providerCode,
      this.toProviderRequest(request, undefined, accountRef),
    );
  }

  private toProviderRequest(
    request: RawBodyRequest<Request> | Request,
    body: unknown,
    accountRef: string | null,
  ): ProviderWebhookRequest {
    const url = request.originalUrl ?? request.url ?? '';
    const queryStart = url.indexOf('?');
    return {
      method: request.method,
      query: this.flatQuery(request.query),
      rawQuery: queryStart >= 0 ? url.slice(queryStart + 1) : '',
      routeAccountRef: accountRef,
      headers: request.headers,
      rawBody: (request as RawBodyRequest<Request>).rawBody?.toString('utf8') ?? '',
      body,
    };
  }

  private flatQuery(query: Request['query']): ProviderWebhookRequest['query'] {
    const result: ProviderWebhookRequest['query'] = {};
    for (const [key, value] of Object.entries(query ?? {})) {
      if (typeof value === 'string') result[key] = value;
      else if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
        result[key] = value as string[];
    }
    return result;
  }
}
