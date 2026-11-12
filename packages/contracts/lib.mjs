import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];

export function validateJsonSchema(schema, label) {
  const errors = [];
  if (!schema.$id) errors.push(`${label}: missing $id`);
  if (!schema.title) errors.push(`${label}: missing title`);
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats.default(ajv);
  try {
    ajv.compile(schema);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
  }
  return errors;
}

export function validateOpenApi(document, label) {
  const errors = [];
  if (!String(document.openapi ?? '').startsWith('3.1')) {
    errors.push(`${label}: must declare OpenAPI 3.1`);
  }
  if (!document.info?.title || !document.info?.version) {
    errors.push(`${label}: missing info.title or info.version`);
  }
  const paths = Object.entries(document.paths ?? {});
  if (paths.length === 0) errors.push(`${label}: has no paths`);
  for (const [path, item] of paths) {
    for (const method of HTTP_METHODS.filter((name) => item[name])) {
      if (!item[method].operationId) errors.push(`${label}: ${method} ${path} has no operationId`);
      if (!item[method].responses) errors.push(`${label}: ${method} ${path} has no responses`);
    }
  }
  return errors;
}

function typeOf(schema) {
  return JSON.stringify(schema?.type ?? null);
}

export function findSchemaBreakingChanges(previous, current, location = '#') {
  const breaking = [];
  if (previous.type && typeOf(previous) !== typeOf(current)) {
    breaking.push(`${location}: type changed from ${typeOf(previous)} to ${typeOf(current)}`);
  }
  for (const value of previous.enum ?? []) {
    if (current.enum && !current.enum.includes(value)) {
      breaking.push(`${location}: enum value "${value}" was removed`);
    }
  }
  if (previous.additionalProperties !== false && current.additionalProperties === false) {
    breaking.push(`${location}: additionalProperties became false`);
  }
  if (!previous.enum && current.enum) breaking.push(`${location}: enum was added`);
  if (previous.items && current.items) {
    breaking.push(...findSchemaBreakingChanges(previous.items, current.items, `${location}/items`));
  }
  for (const keyword of ['oneOf', 'anyOf']) {
    const before = previous[keyword] ?? [];
    const after = current[keyword] ?? [];
    if (before.length > after.length) breaking.push(`${location}: ${keyword} lost an option`);
    before.slice(0, after.length).forEach((option, index) => {
      breaking.push(
        ...findSchemaBreakingChanges(option, after[index], `${location}/${keyword}/${index}`),
      );
    });
  }
  const previousRequired = new Set(previous.required ?? []);
  for (const name of current.required ?? []) {
    if (!previousRequired.has(name)) breaking.push(`${location}: "${name}" became required`);
  }
  for (const [name, schema] of Object.entries(previous.properties ?? {})) {
    const next = current.properties?.[name];
    if (!next) breaking.push(`${location}: property "${name}" was removed`);
    else breaking.push(...findSchemaBreakingChanges(schema, next, `${location}/${name}`));
  }
  for (const [name, schema] of Object.entries(previous.$defs ?? {})) {
    const next = current.$defs?.[name];
    if (!next) breaking.push(`${location}: definition "${name}" was removed`);
    else breaking.push(...findSchemaBreakingChanges(schema, next, `${location}/$defs/${name}`));
  }
  return breaking;
}

function compareContent(previous, current, label) {
  return Object.entries(previous?.content ?? {}).flatMap(([mediaType, media]) => {
    const next = current?.content?.[mediaType];
    if (!next) return [`${label}: ${mediaType} was removed`];
    if (!media.schema || !next.schema) return [];
    return findSchemaBreakingChanges(media.schema, next.schema, `${label} ${mediaType}`);
  });
}

function compareParameters(previous = [], current = [], label) {
  const key = (parameter) => `${parameter.in}:${parameter.name}`;
  const before = new Map(previous.map((parameter) => [key(parameter), parameter]));
  const after = new Map(current.map((parameter) => [key(parameter), parameter]));
  const breaking = [];
  for (const [id, parameter] of before) {
    if (!after.has(id)) breaking.push(`${label}: parameter "${parameter.name}" was removed`);
  }
  for (const [id, parameter] of after) {
    if (parameter.required && !before.get(id)?.required) {
      breaking.push(`${label}: parameter "${parameter.name}" became required`);
    }
  }
  return breaking;
}

function compareOperation(operation, next, label) {
  const breaking = [
    ...compareParameters(operation.parameters, next.parameters, label),
    ...compareContent(operation.requestBody, next.requestBody, `${label} request`),
  ];
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    const nextResponse = next.responses?.[status];
    if (!nextResponse) breaking.push(`${label} no longer returns ${status}`);
    else breaking.push(...compareContent(response, nextResponse, `${label} ${status}`));
  }
  return breaking;
}

export function findOpenApiBreakingChanges(previous, current) {
  const breaking = [];
  for (const [path, item] of Object.entries(previous.paths ?? {})) {
    for (const method of HTTP_METHODS.filter((name) => item[name])) {
      const label = `${method.toUpperCase()} ${path}`;
      const next = current.paths?.[path]?.[method];
      if (next) breaking.push(...compareOperation(item[method], next, label));
      else breaking.push(`${label} was removed`);
    }
  }
  for (const [name, schema] of Object.entries(previous.components?.schemas ?? {})) {
    const next = current.components?.schemas?.[name];
    if (next) breaking.push(...findSchemaBreakingChanges(schema, next, `schema ${name}`));
    else breaking.push(`schema "${name}" was removed`);
  }
  return breaking;
}

export function parseContract(file, text) {
  return file.endsWith('.json') ? JSON.parse(text) : parse(text);
}

export function versionedPath(file) {
  const match = file.match(/^(.+)\/([^/]+)\.(v\d+)\.([^/]+)$/);
  return match ? `${match[1]}/${match[3]}/${match[2]}.${match[4]}` : null;
}

export function isDraft(contract) {
  return (contract['x-status'] ?? contract.info?.['x-status']) === 'draft';
}
