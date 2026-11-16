import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { PLATFORM_DIR, loadVersions } from './lib.mjs';
import { checkPolicy } from './policy.mjs';

const OVERLAYS_DIR = 'infra/k8s/overlays';
const KUBERNETES_VERSION = '1.35.0';

function kustomizeDirectories() {
  const directories = existsSync(PLATFORM_DIR) ? [{ path: PLATFORM_DIR, overlay: 'platform' }] : [];
  if (existsSync(OVERLAYS_DIR)) {
    for (const name of readdirSync(OVERLAYS_DIR).sort()) {
      const path = join(OVERLAYS_DIR, name);
      if (existsSync(join(path, 'kustomization.yaml'))) directories.push({ path, overlay: name });
    }
  }
  return directories;
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error?.code === 'ENOENT') {
    console.error(`${command} is not installed; see infra/k8s/README.md for the pinned version`);
    process.exit(1);
  }
  return result;
}

function validateSchemas(manifest, versions) {
  const nonStandalone = `https://raw.githubusercontent.com/yannh/kubernetes-json-schema/${versions.kubernetesJsonSchema}/{{.NormalizedKubernetesVersion}}/{{.ResourceKind}}{{.KindSuffix}}.json`;
  const catalog = `https://raw.githubusercontent.com/datreeio/CRDs-catalog/${versions.crdsCatalog}/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json`;
  const result = run(
    'kubeconform',
    [
      '-strict',
      '-summary',
      '-output',
      'json',
      '-kubernetes-version',
      KUBERNETES_VERSION,
      '-schema-location',
      'default',
      '-schema-location',
      nonStandalone,
      '-schema-location',
      catalog,
      '-',
    ],
    manifest,
  );
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return [`kubeconform did not report: ${result.stderr.trim()}`];
  }
  const problems = (report.resources ?? [])
    .filter((resource) => resource.status !== 'statusValid')
    .map((resource) =>
      `${resource.kind} ${resource.name}: ${resource.status} ${resource.msg ?? ''}`.trim(),
    );
  const { valid = 0, invalid = 0, errors = 0, skipped = 0 } = report.summary ?? {};
  console.log(
    `  kubeconform: valid ${valid}, invalid ${invalid}, errors ${errors}, skipped ${skipped}`,
  );
  return problems;
}

const versions = loadVersions();
const directories = kustomizeDirectories();
if (directories.length === 0) {
  console.error('no kustomize directories found');
  process.exit(1);
}

let failed = false;
for (const { path, overlay } of directories) {
  console.log(`${path}`);
  const rendered = run('kubectl', ['kustomize', path]);
  if (rendered.status !== 0) {
    console.error(`  kubectl kustomize failed: ${rendered.stderr.trim()}`);
    failed = true;
    continue;
  }
  const problems = validateSchemas(rendered.stdout, versions);
  const docs = parseAllDocuments(rendered.stdout).map((doc) => doc.toJS());
  for (const finding of checkPolicy(docs, { overlay })) {
    problems.push(`${finding.rule} ${finding.kind} ${finding.name}: ${finding.message}`);
  }
  for (const problem of problems) console.error(`  ${problem}`);
  console.log(`  policy and schema problems: ${problems.length}`);
  if (problems.length > 0) failed = true;
}

const gateway = spawnSync('node', ['scripts/gateway/check.mjs'], { stdio: 'inherit' });
if (gateway.status !== 0) failed = true;
process.exit(failed ? 1 : 0);
