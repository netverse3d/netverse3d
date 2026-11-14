import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentTenantPayload {
  tenantId: string;
  tenantCode: string;
}

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenant as CurrentTenantPayload;
});
