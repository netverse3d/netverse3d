import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  SMOKE_GATEWAY_URL: 'http://127.0.0.1:58180',
  SMOKE_KAFKA_BROKERS: '127.0.0.1:59192',
  SMOKE_NOTIFICATION_GRPC: '127.0.0.1:53203',
  SMOKE_MAILBOX_URL: 'http://127.0.0.1:58125',
};
const result = spawnSync('node', ['tests/e2e/stack-smoke.mjs'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
