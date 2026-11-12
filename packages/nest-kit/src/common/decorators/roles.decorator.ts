import { SetMetadata } from '@nestjs/common';

export const ROLES_METADATA = 'route:roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_METADATA, roles);
