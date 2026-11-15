import { AuditResourceInput } from '@netverse/nest-kit';

export const resourceIdFromResult = ({ result }: AuditResourceInput): string | undefined =>
  (result as { id?: string } | undefined)?.id;

export const resourceIdFromParam =
  (name: string) =>
  ({ params }: AuditResourceInput): string | undefined =>
    params[name];
