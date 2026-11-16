import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  CLUSTER_CONFIG,
  CLUSTER_NAME,
  CONTEXT,
  IMAGES,
  LOCAL_OVERLAY,
  PLATFORM_DIR,
  checkFreeDisk,
  checkToolVersions,
  clusterExists,
  dockerDataPath,
  generatedIdentityKeys,
  loadVersions,
  parseK3dVersion,
  parseKubectlMinor,
  secretManifest,
} from './lib.mjs';

const OPERATORS = [
  ['cnpg-system', 'cnpg-controller-manager', '300s'],
  ['strimzi', 'strimzi-cluster-operator', '300s'],
  ['netverse-system', 'traefik', '180s'],
];
const APP_DEPLOYMENTS = [...IMAGES.map((image) => image.id), 'gateway-probe'];

function run(command, args, { capture = false, input } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    stdio: input !== undefined ? ['pipe', 'inherit', 'inherit'] : capture ? 'pipe' : 'inherit',
  });
  if (result.error && result.error.code !== 'ENOENT') throw result.error;
  return result;
}

function mustRun(command, args) {
  const result = run(command, args);
  if (result.status !== 0) {
    console.error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
    process.exit(1);
  }
}

function kubectl(args) {
  mustRun('kubectl', ['--context', CONTEXT, ...args]);
}

function requireDirectory(path) {
  if (!existsSync(path)) {
    console.error(`missing ${path}`);
    process.exit(1);
  }
}

function checkTools(versions) {
  const k3d = parseK3dVersion(run('k3d', ['version'], { capture: true }).stdout);
  const kubectlMinor = parseKubectlMinor(
    run('kubectl', ['version', '--client', '-o', 'json'], { capture: true }).stdout,
  );
  const errors = checkToolVersions({ k3d, kubectlMinor }, versions);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
}

function dockerSettings() {
  try {
    return JSON.parse(readFileSync(`${process.env.APPDATA}/Docker/settings-store.json`, 'utf8'));
  } catch {
    return null;
  }
}

function existingAncestor(path) {
  let current = path;
  while (!existsSync(current) && dirname(current) !== current) current = dirname(current);
  return current;
}

function checkDisk() {
  const path = dockerDataPath({
    platform: process.platform,
    env: process.env,
    settings: dockerSettings(),
  });
  const stats = statfsSync(existingAncestor(path));
  const errors = checkFreeDisk({
    path,
    freeBytes: stats.bavail * stats.bsize,
    minFreeGb: loadVersions().minFreeDiskGb,
  });
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
}

function ensureIdentityKeys() {
  const existing = run(
    'kubectl',
    ['--context', CONTEXT, '-n', 'netverse', 'get', 'secret', 'identity-keys'],
    {
      capture: true,
    },
  );
  if (existing.status === 0) return;
  const manifest = secretManifest('identity-keys', 'netverse', generatedIdentityKeys());
  const applied = run('kubectl', ['--context', CONTEXT, 'apply', '-f', '-'], {
    input: JSON.stringify(manifest),
  });
  if (applied.status !== 0) {
    console.error('could not create the identity-keys secret');
    process.exit(1);
  }
}

function buildImages() {
  checkDisk();
  for (const image of IMAGES) {
    mustRun('docker', ['build', '-f', image.dockerfile, '-t', `netverse/${image.id}:local`, '.']);
  }
}

function importImages() {
  mustRun('k3d', [
    'image',
    'import',
    '-c',
    CLUSTER_NAME,
    ...IMAGES.map((image) => `netverse/${image.id}:local`),
  ]);
}

function images() {
  buildImages();
  importImages();
}

function up() {
  const versions = loadVersions();
  checkTools(versions);
  buildImages();
  const listed = run('k3d', ['cluster', 'list', '-o', 'json'], { capture: true }).stdout;
  if (!clusterExists(listed, CLUSTER_NAME)) {
    mustRun('k3d', ['cluster', 'create', '--config', CLUSTER_CONFIG]);
  }
  importImages();
  requireDirectory(PLATFORM_DIR);
  kubectl([
    'apply',
    '--server-side',
    '--force-conflicts',
    '-f',
    `https://github.com/kubernetes-sigs/gateway-api/releases/download/${versions.gatewayApi}/standard-install.yaml`,
  ]);
  kubectl([
    'wait',
    '--for=condition=Established',
    'crd/gatewayclasses.gateway.networking.k8s.io',
    '--timeout=120s',
  ]);
  kubectl(['apply', '--server-side', '--force-conflicts', '-k', PLATFORM_DIR]);
  kubectl(['wait', '--for=condition=Established', 'crd', '--all', '--timeout=120s']);
  for (const [namespace, deployment, timeout] of OPERATORS) {
    kubectl(['-n', namespace, 'rollout', 'status', `deploy/${deployment}`, `--timeout=${timeout}`]);
  }
  ensureIdentityKeys();
  requireDirectory(LOCAL_OVERLAY);
  kubectl(['apply', '--server-side', '--force-conflicts', '-k', LOCAL_OVERLAY]);
  kubectl([
    '-n',
    'netverse-data',
    'wait',
    'cluster.postgresql.cnpg.io/netverse-pg',
    '--for=condition=Ready',
    '--timeout=600s',
  ]);
  kubectl([
    '-n',
    'netverse-data',
    'wait',
    'kafka/netverse-kafka',
    '--for=condition=Ready',
    '--timeout=900s',
  ]);
  for (const deployment of APP_DEPLOYMENTS) {
    kubectl(['-n', 'netverse', 'rollout', 'status', `deploy/${deployment}`, '--timeout=600s']);
  }
  console.log(`Cluster ${CLUSTER_NAME} is ready at http://127.0.0.1:58180/`);
}

const commands = {
  up,
  images,
  down: () => mustRun('k3d', ['cluster', 'delete', CLUSTER_NAME]),
  status: () => kubectl(['get', 'pods', '-A']),
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(`Usage: node scripts/k8s/cluster.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}
command();
