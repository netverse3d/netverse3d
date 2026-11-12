import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, concatMap, from, mergeMap, Observable, throwError } from 'rxjs';
import { resolveError } from '../../../common/filters/global-exception.filter';
import { AUDIT_METADATA, AuditOptions } from '../audit.decorator';
import { AuditService } from '../services/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(
      AUDIT_METADATA,
      context.getHandler(),
    );
    if (!options) {
      return next.handle();
    }
    const { params } = context.switchToHttp().getRequest<Request>();
    const flatParams = params as Record<string, string>;

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        await this.audit.recordWithoutFailing({
          action: options.action,
          resourceType: options.resourceType,
          resourceId: options.resourceId?.({ params: flatParams, result }),
          outcome: 'SUCCESS',
        });
        return result;
      }),
      catchError((error: unknown) =>
        from(
          this.audit.recordWithoutFailing({
            action: options.action,
            resourceType: options.resourceType,
            resourceId: options.resourceId?.({ params: flatParams, result: undefined }),
            outcome: 'FAILURE',
            errorCode: resolveError(error).code,
          }),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }
}
