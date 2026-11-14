import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { currentRequestId } from '../context/request-context';
import { RAW_RESPONSE_METADATA } from '../decorators/raw-response.decorator';
import { ApiResponseDto, SUCCESS_CODE } from '../dto/api-response.dto';
import { RawHttpResponse } from '../dto/raw-http-response';
import { normalizeJsonValue } from '../utils/normalize-json-value';

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiResponseDto<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponseDto<T> | T> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) {
      return next.handle();
    }
    return next.handle().pipe(
      map((result) =>
        result instanceof RawHttpResponse
          ? this.rawResponse(context, result)
          : result instanceof StreamableFile
            ? result
            : {
                code: SUCCESS_CODE,
                message: null,
                result: normalizeJsonValue(result ?? null) as T | null,
                requestId: currentRequestId(),
              },
      ),
    );
  }

  private rawResponse(context: ExecutionContext, result: RawHttpResponse): T {
    context.switchToHttp().getResponse<{ status(code: number): unknown }>().status(result.status);
    return normalizeJsonValue(result.body) as T;
  }
}
