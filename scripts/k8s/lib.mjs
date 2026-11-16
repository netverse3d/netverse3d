import { readFileSync } from 'node:fs';

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
