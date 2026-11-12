import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError, Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { AppConfig } from '../../config/app-config';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly config: AppConfig) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.config.http.requestTimeoutMs),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError ? new AppException(ErrorCode.TIMEOUT) : error,
        ),
      ),
    );
  }
}
