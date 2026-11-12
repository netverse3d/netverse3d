import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

export interface FieldViolation {
  field: string;
  errors: string[];
}

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldViolation[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, errors: Object.values(error.constraints) }] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(ErrorCode.VALIDATION, { details: flattenValidationErrors(errors) }),
  });
}
