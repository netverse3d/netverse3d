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
  if (previous.items && current.items) {
    breaking.push(...findSchemaBreakingChanges(previous.items, current.items, `${location}/items`));
  }
  if ((previous.oneOf?.length ?? 0) > (current.oneOf?.length ?? 0)) {
    breaking.push(`${location}: oneOf lost an option`);
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

export function findOpenApiBreakingChanges(previous, current) {
  const breaking = [];
  for (const [path, item] of Object.entries(previous.paths ?? {})) {
    for (const method of HTTP_METHODS.filter((name) => item[name])) {
      const next = current.paths?.[path]?.[method];
      if (!next) {
        breaking.push(`${method.toUpperCase()} ${path} was removed`);
        continue;
      }
      for (const status of Object.keys(item[method].responses ?? {})) {
        if (!next.responses?.[status]) {
          breaking.push(`${method.toUpperCase()} ${path} no longer returns ${status}`);
        }
      }
    }
  }
  return breaking;
}

export function parseContract(file, text) {
  return file.endsWith('.json') ? JSON.parse(text) : parse(text);
}

export function isDraft(contract) {
  return (contract['x-status'] ?? contract.info?.['x-status']) === 'draft';
}
