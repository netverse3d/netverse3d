import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA = 'route:audit';

export interface AuditResourceInput {
  params: Record<string, string>;
  result: unknown;
}

export interface AuditOptions {
  action: string;
  resourceType: string;
  resourceId?: (input: AuditResourceInput) => string | undefined;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_METADATA, options);
