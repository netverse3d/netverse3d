import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const CONTEXT = process.env.K8S_CONTEXT;
const { busybox } = JSON.parse(readFileSync('infra/k8s/versions.json', 'utf8'));
const TARGET = 'http://identity.netverse.svc:3000/livez';

function probeFrom(namespace) {
  const name = `np-probe-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return spawnSync(
    'kubectl',
    [
      '--context',
      CONTEXT,
      'run',
      name,
      '--rm',
      '-i',
      '--restart=Never',
      '-n',
      namespace,
      `--image=busybox:${busybox}`,
      '--',
      'wget',
      '-qO-',
      '-T',
      '3',
      TARGET,
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
}

test('pod ngoài namespace không gọi thẳng được service', (t) => {
  if (!CONTEXT) {
    t.skip('K8S_CONTEXT is not set');
    return;
  }
  const result = probeFrom('default');
  assert.notEqual(result.status, null, `probe could not run: ${result.error?.message}`);
  assert.notEqual(result.status, 0, `the probe reached identity: ${result.stdout}`);
  assert.ok(!result.stdout.includes('"ok"'), result.stdout);
});

test('pod trong namespace gọi được service', (t) => {
  if (!CONTEXT) {
    t.skip('K8S_CONTEXT is not set');
    return;
  }
  const result = probeFrom('netverse');
  assert.notEqual(result.status, null, `probe could not run: ${result.error?.message}`);
  assert.equal(result.status, 0, `probe failed: ${result.stderr}`);
  assert.ok(result.stdout.length > 0);
});
