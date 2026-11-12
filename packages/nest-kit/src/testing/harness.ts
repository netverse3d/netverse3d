import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuditLogRow, Database } from '../infrastructure/database/database';
import { TokenIssuer } from './token-issuer';

export interface ConformanceApp {
  app: NestExpressApplication;
  tokens: TokenIssuer;
  close(): Promise<void>;
}

export interface ConformanceHarness {
  createApp(overrides?: Record<string, string>): Promise<ConformanceApp>;
  publicPaths: string[];
  unversionedPaths: string[];
  openApiFile: string;
}

export type InspectableDatabase = Database & {
  auditLog: {
    findFirstOrThrow(args?: object): Promise<AuditLogRow>;
    update(args: object): Promise<unknown>;
    delete(args: object): Promise<unknown>;
  };
};
