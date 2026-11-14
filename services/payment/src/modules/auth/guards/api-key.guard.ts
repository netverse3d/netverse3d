import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { assignActor } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { PaymentErrorCode } from '../../payments/payment-error-codes';
import { ApiKeyAuthService } from '../services/api-key-auth.service';

interface ApiKeyAuthenticatedRequest extends Request {
  tenant?: { tenantId: string; tenantCode: string };
  apiClient?: { apiKeyId: string; keyPrefix: string; tenantId: string };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: ApiKeyAuthService,
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyAuthenticatedRequest>();
    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new AppException(PaymentErrorCode.API_KEY_MISSING);
    }

    const auth = await this.authService.authenticate(apiKey);
    request.tenant = { tenantId: auth.tenant.id, tenantCode: auth.tenant.code };
    request.apiClient = {
      apiKeyId: auth.apiKey.id,
      keyPrefix: auth.apiKey.key_prefix,
      tenantId: auth.tenant.id,
    };
    assignActor({ subject: auth.apiKey.id, tenantId: auth.tenant.id, roles: [] });
    this.logger.assign({ actorSubject: auth.apiKey.id, tenantId: auth.tenant.id });
    return true;
  }
}
