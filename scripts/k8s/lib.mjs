import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, win32 } from 'node:path';

export const CLUSTER_NAME = 'netverse';
export const CONTEXT = `k3d-${CLUSTER_NAME}`;
export const VERSIONS_FILE = 'infra/k8s/versions.json';
export const CLUSTER_CONFIG = 'infra/k8s/k3d/cluster.yaml';
export const PLATFORM_DIR = 'infra/k8s/platform';
export const LOCAL_OVERLAY = 'infra/k8s/overlays/local';
export const IMAGES = [
  { id: 'identity', dockerfile: 'services/identity/Dockerfile' },
  { id: 'media', dockerfile: 'services/media/Dockerfile' },
  { id: 'notification', dockerfile: 'services/notification/Dockerfile' },
  { id: 'payment', dockerfile: 'services/payment/Dockerfile' },
  { id: 'web-3d', dockerfile: 'apps/web-3d/Dockerfile' },
];

export function loadVersions(path = VERSIONS_FILE) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function parseK3dVersion(stdout) {
  return /k3d version v(\d+\.\d+\.\d+)/.exec(stdout ?? '')?.[1] ?? null;
}

export function parseKubectlMinor(stdout) {
  try {
    return String(JSON.parse(stdout).clientVersion.minor).replace(/\D/g, '') || null;
  } catch {
    return null;
  }
}

export function checkToolVersions({ k3d, kubectlMinor }, versions) {
  const errors = [];
  if (k3d !== versions.k3d) {
    errors.push(
      k3d
        ? `k3d ${k3d} found, ${versions.k3d} required`
        : `k3d not found, ${versions.k3d} required`,
    );
  }
  const requiredMinor = versions.kubectl.split('.')[1];
  if (kubectlMinor !== requiredMinor) {
    errors.push(
      kubectlMinor
        ? `kubectl 1.${kubectlMinor} found, ${versions.kubectl} required`
        : `kubectl not found, ${versions.kubectl} required`,
    );
  }
  return errors;
}

export function clusterExists(listJson, name) {
  try {
    return JSON.parse(listJson).some((cluster) => cluster.name === name);
  } catch {
    return false;
  }
}

const GIB = 1024 ** 3;

export function generatedIdentityKeys() {
  return {
    KEY_ENCRYPTION_SECRET: randomBytes(32).toString('hex'),
    OTP_HASH_SECRET: randomBytes(32).toString('hex'),
  };
}

export function secretManifest(name, namespace, stringData) {
  return { apiVersion: 'v1', kind: 'Secret', metadata: { name, namespace }, stringData };
}

export function dockerDataPath({ platform, env, settings }) {
  if (env.NETVERSE_DOCKER_DATA_DIR) return env.NETVERSE_DOCKER_DATA_DIR;
  if (platform === 'win32') {
    return settings?.CustomWslDistroDir || win32.join(env.LOCALAPPDATA ?? '', 'Docker');
  }
  if (platform === 'darwin') return join(env.HOME ?? '', 'Library/Containers/com.docker.docker');
  return '/var/lib/docker';
}

export function checkFreeDisk({ path, freeBytes, minFreeGb }) {
  const freeGb = Math.round((freeBytes / GIB) * 10) / 10;
  return freeBytes >= minFreeGb * GIB
    ? []
    : [
        `only ${freeGb} GB free where Docker stores data (${path}); at least ${minFreeGb} GB is required before building images`,
      ];
}
