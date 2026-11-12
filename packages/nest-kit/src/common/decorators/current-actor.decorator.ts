import { createParamDecorator } from '@nestjs/common';
import { Actor, currentActor } from '../context/request-context';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

export const CurrentActor = createParamDecorator((): Actor => {
  const actor = currentActor();
  if (!actor) {
    throw new AppException(ErrorCode.UNAUTHENTICATED);
  }
  return actor;
});
