import { join } from 'node:path';
import { describePublishedOpenApi } from '@netverse/nest-kit/testing';

describePublishedOpenApi(
  join(__dirname, '..', '..', '..', 'openapi.yaml'),
  require.resolve('@netverse/contracts/openapi/v1/identity.yaml'),
);
