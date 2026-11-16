const WORKLOAD_KINDS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'Job']);
const RESOURCE_NAMESPACES = new Set(['netverse', 'netverse-data', 'netverse-system']);
const HARDENED_NAMESPACES = new Set(['netverse', 'netverse-system']);
const HARDENING_EXEMPT = new Set(['web-3d']);
const APP_NAMESPACE = 'netverse';
const STAGING_REGISTRY = 'ghcr.io/netverse3d/';
const POD_SECURITY_LABEL = 'pod-security.kubernetes.io/enforce';

function finding(rule, doc, message) {
  return {
    rule,
    kind: doc.kind,
    name: `${doc.metadata?.namespace ?? '-'}/${doc.metadata?.name}`,
    message,
  };
}

function podSpec(doc) {
  return doc.spec?.template?.spec ?? {};
}

function allContainers(spec) {
  return [...(spec.initContainers ?? []), ...(spec.containers ?? [])];
}

function hasPinnedTag(image) {
  if (image.includes('@sha256:')) return true;
  const lastSegment = image.slice(image.lastIndexOf('/') + 1);
  const separator = lastSegment.indexOf(':');
  return separator > 0 && lastSegment.slice(separator + 1) !== 'latest';
}

function imageFindings(doc, overlay) {
  const findings = [];
  for (const container of allContainers(podSpec(doc))) {
    if (!hasPinnedTag(container.image ?? '')) {
      findings.push(
        finding(
          'P1',
          doc,
          `${container.name} image ${container.image} must pin a tag other than latest`,
        ),
      );
    }
    const isApp = doc.kind === 'Deployment' && doc.metadata?.namespace === APP_NAMESPACE;
    if (overlay === 'staging' && isApp && !container.image?.startsWith(STAGING_REGISTRY)) {
      findings.push(
        finding('P1', doc, `${container.name} image must come from ${STAGING_REGISTRY}`),
      );
    }
  }
  return findings;
}

function resourceFindings(doc) {
  if (!RESOURCE_NAMESPACES.has(doc.metadata?.namespace)) return [];
  return allContainers(podSpec(doc))
    .filter(
      (container) => !container.resources?.requests?.memory || !container.resources?.limits?.memory,
    )
    .map((container) =>
      finding('P2', doc, `${container.name} must set memory requests and limits`),
    );
}

function hardeningFindings(doc) {
  if (doc.kind !== 'Deployment' || !HARDENED_NAMESPACES.has(doc.metadata?.namespace)) return [];
  if (HARDENING_EXEMPT.has(doc.metadata?.name)) return [];
  const spec = podSpec(doc);
  const findings = [];
  for (const container of allContainers(spec)) {
    const context = container.securityContext ?? {};
    const runAsNonRoot = context.runAsNonRoot ?? spec.securityContext?.runAsNonRoot;
    const seccomp = context.seccompProfile?.type ?? spec.securityContext?.seccompProfile?.type;
    const problems = [];
    if (runAsNonRoot !== true) problems.push('runAsNonRoot');
    if (context.allowPrivilegeEscalation !== false) problems.push('allowPrivilegeEscalation=false');
    if (!(context.capabilities?.drop ?? []).includes('ALL')) problems.push('drop ALL capabilities');
    if (context.readOnlyRootFilesystem !== true) problems.push('readOnlyRootFilesystem');
    if (seccomp !== 'RuntimeDefault') problems.push('RuntimeDefault seccomp');
    if (problems.length > 0) {
      findings.push(finding('P3', doc, `${container.name} must set ${problems.join(', ')}`));
    }
  }
  return findings;
}

function probeFindings(doc) {
  if (doc.kind !== 'Deployment' || doc.metadata?.namespace !== APP_NAMESPACE) return [];
  const [main] = podSpec(doc).containers ?? [];
  if (main?.readinessProbe && main?.livenessProbe) return [];
  return [
    finding('P4', doc, `${main?.name ?? 'container'} must define readiness and liveness probes`),
  ];
}

const ENV_REFERENCE = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/g;

function envOrderFindings(doc) {
  const findings = [];
  for (const container of allContainers(podSpec(doc))) {
    const declared = new Set();
    for (const variable of container.env ?? []) {
      for (const [, reference] of String(variable.value ?? '').matchAll(ENV_REFERENCE)) {
        if (!declared.has(reference)) {
          findings.push(
            finding(
              'P11',
              doc,
              `${container.name} ${variable.name} uses ${reference} before it is declared`,
            ),
          );
        }
      }
      declared.add(variable.name);
    }
  }
  return findings;
}

function hostAccessFindings(doc) {
  const spec = podSpec(doc);
  const findings = [];
  if (spec.hostNetwork || spec.hostPID || spec.hostIPC) {
    findings.push(finding('P6', doc, 'must not use the host network, PID or IPC namespace'));
  }
  if ((spec.volumes ?? []).some((volume) => volume.hostPath)) {
    findings.push(finding('P6', doc, 'must not mount hostPath volumes'));
  }
  if (allContainers(spec).some((container) => container.securityContext?.privileged)) {
    findings.push(finding('P6', doc, 'must not run privileged containers'));
  }
  return findings;
}

function namespaceFindings(doc) {
  return doc.metadata?.labels?.[POD_SECURITY_LABEL]
    ? []
    : [finding('P5', doc, `namespace must carry ${POD_SECURITY_LABEL}`)];
}

function serviceFindings(doc, overlay) {
  return doc.spec?.type === 'NodePort' && overlay !== 'local'
    ? [finding('P7', doc, 'NodePort services are only allowed in the local overlay')]
    : [];
}

function basicAuthFindings(doc) {
  if (doc.type !== 'kubernetes.io/basic-auth') return [];
  const keys = new Set([...Object.keys(doc.data ?? {}), ...Object.keys(doc.stringData ?? {})]);
  const hasValues = keys.size > 0;
  return hasValues && !(keys.has('username') && keys.has('password'))
    ? [finding('P10', doc, 'basic-auth secrets must carry username and password')]
    : [];
}

function secretFindings(doc, overlay) {
  const hasValues =
    Object.keys(doc.data ?? {}).length + Object.keys(doc.stringData ?? {}).length > 0;
  return overlay === 'staging' && hasValues
    ? [finding('P9', doc, 'staging secrets are created by operators outside the repository')]
    : [];
}

function apiDocsFindings(doc, overlay) {
  if (overlay === 'local') return [];
  const isDocsRoute =
    doc.kind === 'HTTPRoute' &&
    (doc.spec?.rules ?? []).some((rule) =>
      (rule.matches ?? []).some((match) => match.path?.value === '/docs'),
    );
  return doc.metadata?.name === 'api-docs' || isDocsRoute
    ? [finding('P12', doc, 'API documentation is only allowed in the local overlay')]
    : [];
}

function networkFindings(docs) {
  const usesAppNamespace = docs.some(
    (doc) => WORKLOAD_KINDS.has(doc.kind) && doc.metadata?.namespace === APP_NAMESPACE,
  );
  const hasDenyAll = docs.some(
    (doc) =>
      doc.kind === 'NetworkPolicy' &&
      doc.metadata?.namespace === APP_NAMESPACE &&
      doc.metadata?.name === 'default-deny-ingress',
  );
  return usesAppNamespace && !hasDenyAll
    ? [
        {
          rule: 'P8',
          kind: 'NetworkPolicy',
          name: `${APP_NAMESPACE}/default-deny-ingress`,
          message: `namespace ${APP_NAMESPACE} must deny ingress by default`,
        },
      ]
    : [];
}

export function checkPolicy(docs, { overlay }) {
  const findings = [];
  for (const doc of docs.filter(Boolean)) {
    findings.push(...apiDocsFindings(doc, overlay));
    if (WORKLOAD_KINDS.has(doc.kind)) {
      findings.push(
        ...imageFindings(doc, overlay),
        ...resourceFindings(doc),
        ...hardeningFindings(doc),
        ...probeFindings(doc),
        ...hostAccessFindings(doc),
        ...envOrderFindings(doc),
      );
    }
    if (doc.kind === 'Namespace') findings.push(...namespaceFindings(doc));
    if (doc.kind === 'Service') findings.push(...serviceFindings(doc, overlay));
    if (doc.kind === 'Secret') {
      findings.push(...secretFindings(doc, overlay), ...basicAuthFindings(doc));
    }
  }
  return [...findings, ...networkFindings(docs)];
}

export function crdToJsonSchemas(crd) {
  const kind = crd.spec.names.kind.toLowerCase();
  return Object.fromEntries(
    (crd.spec.versions ?? [])
      .filter((version) => version.schema?.openAPIV3Schema)
      .map((version) => [`${kind}_${version.name}.json`, version.schema.openAPIV3Schema]),
  );
}
