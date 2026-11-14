import { AuditResourceInput } from './audit.decorator';

export const resourceIdFromResult = ({ result }: AuditResourceInput): string | undefined =>
  (result as { id?: string } | undefined)?.id;

export const resourceIdFromParam =
  (name: string) =>
  ({ params }: AuditResourceInput): string | undefined =>
    params[name];
