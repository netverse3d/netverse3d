import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { parse } from 'yaml';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUTPUT_DIRECTORY = 'infra/gateway/docs';
export const DOCUMENTS = [
  { service: 'identity', name: 'Identity Service' },
  { service: 'media', name: 'Media Service' },
  { service: 'notification', name: 'Notification Service' },
];

export function projectServiceDocument(source, route, service) {
  const prefix = `/api/${service}`;
  if (
    route?.entrypoint !== 'web' ||
    route.prefix !== `${prefix}/v1` ||
    route.strip !== prefix ||
    route.backend?.service !== service ||
    route.enabled === false
  ) {
    throw new Error(`${service}: missing public gateway route`);
  }
  const paths = Object.fromEntries(
    Object.entries(source.paths ?? {}).filter(
      ([path]) => path === '/v1' || path.startsWith('/v1/'),
    ),
  );
  if (Object.keys(paths).length === 0) {
    throw new Error(`${service}: no public API paths`);
  }
  return { ...source, paths, servers: [{ url: prefix }] };
}

export async function renderPublicDocuments(routes, contracts) {
  const output = {};
  const urls = [];
  const formatOptions = {
    ...(await prettier.resolveConfig(join(ROOT, 'package.json'))),
    parser: 'json',
  };
  for (const { service, name } of DOCUMENTS) {
    const route = routes.routes.find((item) => item.id === service);
    const document = projectServiceDocument(contracts[service], route, service);
    output[join(OUTPUT_DIRECTORY, `${service}.json`)] = await prettier.format(
      JSON.stringify(document),
      formatOptions,
    );
    urls.push({ url: `/docs/${service}.json`, name });
  }
  output[join(OUTPUT_DIRECTORY, 'config.json')] = await prettier.format(
    JSON.stringify({ urls }),
    formatOptions,
  );
  return output;
}

export function loadPublicDocumentInputs() {
  const routes = parse(readFileSync(join(ROOT, 'infra/gateway/routes.yaml'), 'utf8'));
  const contracts = Object.fromEntries(
    DOCUMENTS.map(({ service }) => [
      service,
      parse(readFileSync(join(ROOT, `packages/contracts/openapi/v1/${service}.yaml`), 'utf8')),
    ]),
  );
  return { routes, contracts };
}
