import protobuf from 'protobufjs';

const PROTO3 = /^\s*syntax\s*=\s*"proto3"\s*;/m;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

function walk(namespace, visit) {
  for (const item of namespace.nestedArray ?? []) {
    visit(item);
    walk(item, visit);
  }
}

function expectedPackage(file) {
  const match = file.match(/^grpc\/(v\d+)\/([a-z][a-z0-9-]*)\.proto$/);
  return match ? `netverse.${match[2].replaceAll('-', '_')}.${match[1]}` : null;
}

export function describeProto(text) {
  const parsed = protobuf.parse(text, { keepCase: true });
  const messages = new Map();
  const methods = new Map();
  const names = { messages: [], services: [], enums: [], fields: [], methods: [], values: [] };
  walk(parsed.root, (item) => {
    if (item instanceof protobuf.Type) {
      names.messages.push(item.name);
      const fields = item.fieldsArray.map((field) => ({
        name: field.name,
        number: field.id,
        type: `${field.repeated ? 'repeated ' : ''}${field.type}`,
      }));
      names.fields.push(...fields.map((field) => `${item.name}.${field.name}`));
      messages.set(item.name, fields);
    } else if (item instanceof protobuf.Service) {
      names.services.push(item.name);
      for (const method of item.methodsArray) {
        names.methods.push(`${item.name}.${method.name}`);
        methods.set(
          `${item.name}.${method.name}`,
          `${method.requestType} -> ${method.responseType}`,
        );
      }
    } else if (item instanceof protobuf.Enum) {
      names.enums.push(item.name);
      names.values.push(...Object.keys(item.values).map((value) => `${item.name}.${value}`));
    }
  });
  return { package: parsed.package ?? '', messages, methods, names };
}

function misnamed(items, pattern, kind) {
  return items
    .filter((name) => !pattern.test(name.split('.').pop()))
    .map(
      (name) =>
        `${kind} ${name} is not named in ${pattern === SNAKE_CASE ? 'snake_case' : pattern === PASCAL_CASE ? 'PascalCase' : 'UPPER_SNAKE_CASE'}`,
    );
}

export function validateProto(text, file) {
  let description;
  try {
    description = describeProto(text);
  } catch (error) {
    return [`${file}: ${error.message}`];
  }
  const errors = [];
  if (!PROTO3.test(text)) errors.push(`${file}: must declare syntax proto3`);
  const wanted = expectedPackage(file);
  if (wanted && description.package !== wanted) errors.push(`${file}: package must be ${wanted}`);
  const { names } = description;
  errors.push(
    ...[
      ...misnamed(names.messages, PASCAL_CASE, 'message'),
      ...misnamed(names.services, PASCAL_CASE, 'service'),
      ...misnamed(names.enums, PASCAL_CASE, 'enum'),
      ...misnamed(names.methods, PASCAL_CASE, 'rpc'),
      ...misnamed(names.fields, SNAKE_CASE, 'field'),
      ...misnamed(names.values, UPPER_SNAKE_CASE, 'enum value'),
    ].map((problem) => `${file}: ${problem}`),
  );
  return errors;
}

export function compareProto(previousText, currentText) {
  const previous = describeProto(previousText);
  const current = describeProto(currentText);
  const changes = [];
  const reused = [];

  for (const [message, before] of previous.messages) {
    const after = current.messages.get(message);
    if (!after) {
      changes.push(`message ${message} was removed`);
      continue;
    }
    for (const field of before) {
      const sameName = after.find((item) => item.name === field.name);
      const sameNumber = after.find((item) => item.number === field.number);
      if (sameName) {
        if (sameName.type !== field.type) {
          changes.push(
            `${message}.${field.name} changed type from ${field.type} to ${sameName.type}`,
          );
        }
        if (sameName.number !== field.number) {
          changes.push(
            `${message}.${field.name} changed number from ${field.number} to ${sameName.number}`,
          );
        }
      } else if (sameNumber && sameNumber.type === field.type) {
        changes.push(`${message}.${field.name} was renamed to ${sameNumber.name}`);
      } else if (sameNumber) {
        reused.push(
          `${message} reuses field number ${field.number}: it was ${field.type} ${field.name}, now ${sameNumber.type} ${sameNumber.name}`,
        );
      } else {
        changes.push(`${message}.${field.name} was removed`);
      }
    }
    for (const field of after) {
      const known = before.some((item) => item.name === field.name || item.number === field.number);
      if (!known) changes.push(`${message}.${field.name} was added`);
    }
  }
  for (const message of current.messages.keys()) {
    if (!previous.messages.has(message)) changes.push(`message ${message} was added`);
  }
  for (const [method, signature] of previous.methods) {
    const next = current.methods.get(method);
    if (!next) changes.push(`rpc ${method} was removed`);
    else if (next !== signature) changes.push(`rpc ${method} changed from ${signature} to ${next}`);
  }
  for (const method of current.methods.keys()) {
    if (!previous.methods.has(method)) changes.push(`rpc ${method} was added`);
  }
  return { changes, reused };
}
