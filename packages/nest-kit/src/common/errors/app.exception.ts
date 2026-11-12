import { HttpException } from '@nestjs/common';
import { ErrorCodeDefinition } from './error-code';

export interface AppExceptionOptions {
  message?: string;
  details?: unknown;
}

export class AppException extends HttpException {
  readonly definition: ErrorCodeDefinition;
  readonly details: unknown;

  constructor(definition: ErrorCodeDefinition, options: AppExceptionOptions = {}) {
    super(options.message ?? definition.message, definition.httpStatus);
    this.definition = definition;
    this.details = options.details;
  }
}
