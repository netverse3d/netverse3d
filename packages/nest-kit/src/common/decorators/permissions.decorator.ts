import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_METADATA = 'route:permissions';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_METADATA, permissions);
