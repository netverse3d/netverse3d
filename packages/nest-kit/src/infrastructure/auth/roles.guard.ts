import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Actor, currentActor } from '../../common/context/request-context';
import { PERMISSIONS_METADATA } from '../../common/decorators/permissions.decorator';
import { ROLES_METADATA } from '../../common/decorators/roles.decorator';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { rolesInScope } from './platform-roles';

function serviceMayCall(actor: Actor, permissions: string[]): boolean {
  const granted = actor.service?.permissions ?? [];
  return permissions.length > 0 && permissions.every((permission) => granted.includes(permission));
}

function userMayCall(actor: Actor | null, roles: string[], permissions: string[]): boolean {
  if (roles.length === 0) {
    return permissions.length === 0;
  }
  const held = actor ? rolesInScope(actor) : [];
  return roles.some((role) => held.includes(role));
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_METADATA, targets) ?? [];
    const permissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_METADATA, targets) ?? [];
    const actor = currentActor();
    const allowed = actor?.service
      ? serviceMayCall(actor, permissions)
      : userMayCall(actor, roles, permissions);
    if (!allowed) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
    return true;
  }
}
