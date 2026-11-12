import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentActor } from '../../common/context/request-context';
import { ROLES_METADATA } from '../../common/decorators/roles.decorator';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { rolesInScope } from './platform-roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const actor = currentActor();
    const roles = actor ? rolesInScope(actor) : [];
    if (!required.some((role) => roles.includes(role))) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
    return true;
  }
}
