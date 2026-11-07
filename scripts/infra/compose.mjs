import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  ALL_SERVICES,
  findUnhealthyServices,
  httpProbes,
  parseComposeStatus,
  parseEnvFile,
} from './lib.mjs';

const ENV_FILE = existsSync('.env') ? '.env' : '.env.example';
const BASE_ARGS = [
  'compose',
  '--env-file',
  ENV_FILE,
  '-f',
  'infra/compose/compose.yaml',
  '--profile',
  'observability',
];
const PROBE_ATTEMPTS = 40;
const PROBE_DELAY_MS = 3000;

function compose(args, options = {}) {
  return spawnSync('docker', [...BASE_ARGS, ...args], {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

async function isReachable(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}

async function waitForProbes(env) {
  const failed = [];
  for (const [service, url] of httpProbes(env)) {
    let reachable = false;
    for (let attempt = 0; attempt < PROBE_ATTEMPTS && !reachable; attempt += 1) {
      reachable = await isReachable(url);
      if (!reachable) await sleep(PROBE_DELAY_MS);
    }
    if (!reachable) failed.push(`${service}: ${url} did not respond`);
  }
  return failed;
}

async function smoke() {
  const up = compose(['up', '-d', '--wait', '--wait-timeout', '240']);
  if (up.status !== 0) console.error('docker compose up did not finish cleanly.');
  const status = compose(['ps', '--all', '--format', 'json'], { capture: true });
  const problems = findUnhealthyServices(parseComposeStatus(status.stdout), ALL_SERVICES);
  if (problems.length === 0) {
    problems.push(...(await waitForProbes(parseEnvFile(readFileSync(ENV_FILE, 'utf8')))));
  }
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(`Infrastructure healthy: ${ALL_SERVICES.join(', ')}.`);
}

const command = process.argv[2];
if (command === 'smoke') await smoke();
else if (command === 'up') process.exitCode = compose(['up', '-d', '--wait']).status ?? 1;
else if (command === 'down') process.exitCode = compose(['down']).status ?? 1;
else if (command === 'config') process.exitCode = compose(['config', '--quiet']).status ?? 1;
else {
  console.error('Usage: node scripts/infra/compose.mjs <up|down|smoke|config>');
  process.exitCode = 1;
}
