import { join } from 'node:path';
import {
  describeAuditConformance,
  describeDatabaseTimezoneConformance,
  describeHttpStandardConformance,
  describeLimitsConformance,
} from '@netverse/nest-kit/testing';
import { PUBLIC_PATHS, UNVERSIONED_PATHS } from './support/conformance.config';
import { createTestApp } from './support/test-app';

const harness = {
  createApp: createTestApp,
  publicPaths: PUBLIC_PATHS,
  unversionedPaths: UNVERSIONED_PATHS,
  openApiFile: join(__dirname, '..', 'openapi.yaml'),
};

describeAuditConformance(harness);
describeDatabaseTimezoneConformance(harness);
describeHttpStandardConformance(harness);
describeLimitsConformance(harness);
