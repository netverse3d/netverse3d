import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPolicy, crdToJsonSchemas } from './policy.mjs';

function container(overrides = {}) {
  return {
    name: 'app',
    image: 'netverse/identity:local',
    resources: { requests: { memory: '192Mi' }, limits: { memory: '512Mi' } },
    readinessProbe: { httpGet: { path: '/healthz', port: 'http' } },
    livenessProbe: { httpGet: { path: '/livez', port: 'http' } },
    securityContext: {
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      capabilities: { drop: ['ALL'] },
    },
    ...overrides,
  };
}

function deployment({ name = 'identity', namespace = 'netverse', containerOverrides, pod } = {}) {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace },
    spec: {
      template: {
        spec: {
          securityContext: { runAsNonRoot: true, seccompProfile: { type: 'RuntimeDefault' } },
          containers: [container(containerOverrides)],
          ...pod,
        },
      },
    },
  };
}

const namespace = {
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: { name: 'netverse', labels: { 'pod-security.kubernetes.io/enforce': 'baseline' } },
};
const denyAll = {
  apiVersion: 'networking.k8s.io/v1',
  kind: 'NetworkPolicy',
  metadata: { name: 'default-deny-ingress', namespace: 'netverse' },
  spec: { podSelector: {}, policyTypes: ['Ingress'] },
};

function rulesOf(docs, overlay = 'local') {
  return checkPolicy(docs, { overlay }).map((finding) => finding.rule);
}

test('từ chối image không có tag hoặc tag latest', () => {
  for (const image of ['netverse/identity', 'netverse/identity:latest']) {
    const docs = [namespace, denyAll, deployment({ containerOverrides: { image } })];
    assert.deepEqual(rulesOf(docs), ['P1']);
  }
  const digest = deployment({ containerOverrides: { image: 'ghcr.io/x/pg:17@sha256:abc' } });
  assert.deepEqual(rulesOf([namespace, denyAll, digest]), []);
});

test('từ chối container thiếu giới hạn bộ nhớ', () => {
  const docs = [namespace, denyAll, deployment({ containerOverrides: { resources: {} } })];
  assert.deepEqual(rulesOf(docs), ['P2']);
});

test('từ chối container app chạy root hoặc ghi được hệ tệp gốc', () => {
  const writable = deployment({
    containerOverrides: {
      securityContext: { allowPrivilegeEscalation: false, capabilities: { drop: ['ALL'] } },
    },
  });
  assert.deepEqual(rulesOf([namespace, denyAll, writable]), ['P3']);
  const root = deployment({
    pod: { securityContext: { seccompProfile: { type: 'RuntimeDefault' } } },
  });
  assert.deepEqual(rulesOf([namespace, denyAll, root]), ['P3']);
});

test('miễn trừ web-3d khỏi luật bảo mật container', () => {
  const web = deployment({
    name: 'web-3d',
    containerOverrides: { securityContext: {} },
    pod: { securityContext: {} },
  });
  assert.deepEqual(rulesOf([namespace, denyAll, web]), []);
});

test('từ chối Deployment app thiếu readiness hoặc liveness', () => {
  const docs = [
    namespace,
    denyAll,
    deployment({ containerOverrides: { readinessProbe: undefined } }),
  ];
  assert.deepEqual(rulesOf(docs), ['P4']);
});

test('từ chối namespace thiếu nhãn Pod Security', () => {
  const bare = { ...namespace, metadata: { name: 'netverse' } };
  assert.deepEqual(rulesOf([bare, denyAll]), ['P5']);
});

test('từ chối hostPath và privileged', () => {
  const hostPath = deployment({ pod: { volumes: [{ name: 'host', hostPath: { path: '/var' } }] } });
  const privileged = deployment({
    containerOverrides: {
      securityContext: {
        privileged: true,
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: true,
        capabilities: { drop: ['ALL'] },
      },
    },
  });
  assert.deepEqual(rulesOf([namespace, denyAll, hostPath]), ['P6']);
  assert.deepEqual(rulesOf([namespace, denyAll, privileged]), ['P6']);
});

test('từ chối NodePort ngoài overlay local', () => {
  const nodePort = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'mailbox-host', namespace: 'netverse-data' },
    spec: { type: 'NodePort', ports: [{ port: 8025, nodePort: 32025 }] },
  };
  assert.deepEqual(rulesOf([namespace, denyAll, nodePort], 'local'), []);
  assert.deepEqual(rulesOf([namespace, denyAll, nodePort], 'staging'), ['P7']);
});

test('yêu cầu default-deny-ingress trong namespace netverse', () => {
  assert.deepEqual(rulesOf([namespace, deployment()]), ['P8']);
});

test('từ chối Secret có giá trị trong overlay staging', () => {
  const secret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'pg-identity', namespace: 'netverse-data' },
    data: { password: 'c2VjcmV0' },
  };
  assert.deepEqual(rulesOf([namespace, denyAll, secret], 'local'), []);
  assert.deepEqual(rulesOf([namespace, denyAll, secret], 'staging'), ['P9']);
});

test('manifest mẫu đúng chuẩn không có lỗi nào', () => {
  assert.deepEqual(checkPolicy([namespace, denyAll, deployment()], { overlay: 'local' }), []);
});

test('chuyển CRD thành JSON Schema theo từng phiên bản', () => {
  const crd = {
    kind: 'CustomResourceDefinition',
    spec: {
      group: 'example.io',
      names: { kind: 'Widget' },
      versions: [
        {
          name: 'v1',
          schema: { openAPIV3Schema: { type: 'object', properties: { spec: { type: 'object' } } } },
        },
        { name: 'v1beta1', schema: { openAPIV3Schema: { type: 'object' } } },
      ],
    },
  };
  const schemas = crdToJsonSchemas(crd);
  assert.deepEqual(Object.keys(schemas).sort(), ['widget_v1.json', 'widget_v1beta1.json']);
  assert.equal(schemas['widget_v1.json'].properties.spec.type, 'object');
});

test('chỉ đòi default-deny-ingress khi namespace netverse có workload', () => {
  assert.deepEqual(rulesOf([namespace]), []);
  assert.deepEqual(rulesOf([namespace, deployment()]), ['P8']);
});

test('Secret basic-auth của PostgreSQL có đủ username và password', () => {
  const secret = (data) => ({
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'kubernetes.io/basic-auth',
    metadata: { name: 'pg-identity', namespace: 'netverse-data' },
    data,
  });
  assert.deepEqual(rulesOf([secret({ username: 'aWQ=', password: 'cHc=' })]), []);
  assert.deepEqual(rulesOf([secret({ username: 'aWQ=' })]), ['P10']);
});

test('biến DATABASE_URL đứng sau PG_USER và PG_PASSWORD', () => {
  const env = (order) =>
    deployment({
      containerOverrides: {
        env: order.map((name) =>
          name === 'DATABASE_URL'
            ? { name, value: 'postgresql://$(PG_USER):$(PG_PASSWORD)@db:5432/identity' }
            : { name, value: 'x' },
        ),
      },
    });
  assert.deepEqual(
    rulesOf([namespace, denyAll, env(['PG_USER', 'PG_PASSWORD', 'DATABASE_URL'])]),
    [],
  );
  assert.deepEqual(rulesOf([namespace, denyAll, env(['DATABASE_URL', 'PG_USER', 'PG_PASSWORD'])]), [
    'P11',
    'P11',
  ]);
});
