export interface AuditLogRow {
  id: string;
  occurredAt: Date;
  requestId: string | null;
  tenantId: string | null;
  actorSubject: string | null;
  actorRoles: string[];
  ip: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  errorCode: string | null;
  metadata: unknown;
}

export interface OutboxEventRow {
  id: string;
  type: string;
  aggregateId: string;
  tenantId: string | null;
  payload: unknown;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface AuditLogStore {
  create(args: { data: object }): PromiseLike<unknown>;
  findMany(args: object): PromiseLike<AuditLogRow[]>;
  count(args: object): PromiseLike<number>;
}

export interface OutboxEventStore {
  create(args: { data: object }): PromiseLike<unknown>;
  findMany(args: object): PromiseLike<OutboxEventRow[]>;
  update(args: { where: object; data: object }): PromiseLike<unknown>;
}

export interface DatabaseTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>;
  readonly auditLog: AuditLogStore;
  readonly outboxEvent: OutboxEventStore;
}

export abstract class Database implements DatabaseTransaction {
  abstract $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): PromiseLike<T>;
  abstract $transaction<T>(
    work: (transaction: DatabaseTransaction) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
  abstract readonly auditLog: AuditLogStore;
  abstract readonly outboxEvent: OutboxEventStore;
}

const KNOWN_REQUEST_ERROR = 'PrismaClientKnownRequestError';

export function databaseErrorCode(error: unknown): string | null {
  if (!(error instanceof Error) || error.name !== KNOWN_REQUEST_ERROR) return null;
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
