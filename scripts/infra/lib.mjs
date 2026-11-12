export const CORE_SERVICES = ['postgres', 'redis', 'kafka', 'object-store'];
export const OBSERVABILITY_SERVICES = ['otel-collector', 'prometheus', 'loki', 'grafana'];
export const ALL_SERVICES = [...CORE_SERVICES, ...OBSERVABILITY_SERVICES];

export function parseComposeStatus(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function findUnhealthyServices(statuses, expected = ALL_SERVICES) {
  return expected.flatMap((service) => {
    const status = statuses.find((item) => item.Service === service);
    if (!status) return [`${service}: not created`];
    if (status.State !== 'running') return [`${service}: ${status.State}`];
    if (status.Health && status.Health !== 'healthy') return [`${service}: ${status.Health}`];
    return [];
  });
}

export function httpProbes(env) {
  return [
    ['object-store', `http://127.0.0.1:${env.S3_PORT ?? 58333}/healthz`],
    ['otel-collector', `http://127.0.0.1:${env.OTEL_HEALTH_PORT ?? 53133}/`],
    ['prometheus', `http://127.0.0.1:${env.PROMETHEUS_PORT ?? 59090}/-/ready`],
    ['loki', `http://127.0.0.1:${env.LOKI_PORT ?? 53100}/ready`],
    ['grafana', `http://127.0.0.1:${env.GRAFANA_PORT ?? 53000}/api/health`],
  ];
}

export function parseEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

export function findMissingTools(probe, tools) {
  return tools.filter((tool) => !probe(tool));
}
