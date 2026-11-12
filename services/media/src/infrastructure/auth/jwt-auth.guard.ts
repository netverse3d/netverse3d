import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { errors as joseErrors } from 'jose';
import { PinoLogger } from 'nestjs-pino';
import { assignActor } from '../../common/context/request-context';
import { IS_PUBLIC_METADATA } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { JwtVerifier } from './jwt-verifier.service';

const BEARER_PREFIX = 'Bearer ';

function isKeySetUnavailable(error: unknown): boolean {
  return error instanceof joseErrors.JWKSTimeout || !(error instanceof joseErrors.JOSEError);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const header = context.switchToHttp().getRequest<Request>().header('authorization');
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    try {
      const actor = await this.verifier.verify(header.slice(BEARER_PREFIX.length));
      assignActor(actor);
      this.logger.assign({ actorSubject: actor.subject, tenantId: actor.tenantId });
      return true;
    } catch (error) {
      throw new AppException(
        isKeySetUnavailable(error) ? ErrorCode.SERVICE_UNAVAILABLE : ErrorCode.UNAUTHENTICATED,
      );
    }
  }
}
