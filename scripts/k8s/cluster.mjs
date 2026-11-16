import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  CLUSTER_CONFIG,
  CLUSTER_NAME,
  CONTEXT,
  IMAGES,
  LOCAL_OVERLAY,
  PLATFORM_DIR,
  checkToolVersions,
  clusterExists,
  loadVersions,
  parseK3dVersion,
  parseKubectlMinor,
} from './lib.mjs';

const OPERATORS = [
  ['cnpg-system', 'cnpg-controller-manager', '300s'],
  ['strimzi', 'strimzi-cluster-operator', '300s'],
  ['netverse-system', 'traefik', '180s'],
];
const APP_DEPLOYMENTS = [...IMAGES.map((image) => image.id), 'gateway-probe'];

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
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

function images() {
  for (const image of IMAGES) {
    const tag = `netverse/${image.id}:local`;
    mustRun('docker', ['build', '-f', image.dockerfile, '-t', tag, '.']);
    mustRun('k3d', ['image', 'import', '-c', CLUSTER_NAME, tag]);
  }
}

function up() {
  checkTools(loadVersions());
  const listed = run('k3d', ['cluster', 'list', '-o', 'json'], { capture: true }).stdout;
  if (!clusterExists(listed, CLUSTER_NAME)) {
    mustRun('k3d', ['cluster', 'create', '--config', CLUSTER_CONFIG]);
  }
  images();
  requireDirectory(PLATFORM_DIR);
  kubectl(['apply', '--server-side', '--force-conflicts', '-k', PLATFORM_DIR]);
  kubectl(['wait', '--for=condition=Established', 'crd', '--all', '--timeout=120s']);
  for (const [namespace, deployment, timeout] of OPERATORS) {
    kubectl(['-n', namespace, 'rollout', 'status', `deploy/${deployment}`, `--timeout=${timeout}`]);
  }
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
