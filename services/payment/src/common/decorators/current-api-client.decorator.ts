import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentApiClientPayload {
  apiKeyId: string;
  keyPrefix: string;
  tenantId: string;
}

export const CurrentApiClient = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.apiClient as CurrentApiClientPayload;
});
