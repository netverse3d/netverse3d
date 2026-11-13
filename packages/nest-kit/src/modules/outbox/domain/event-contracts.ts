import { readFileSync } from 'node:fs';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { EventEnvelope } from './event-envelope';
import { isServiceName } from './event-topic';

export class InvalidEventError extends Error {}

interface ServiceContract {
  types: ReadonlySet<string>;
  validateData: ValidateFunction;
}

function readSchema(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(require.resolve(file), 'utf8')) as Record<string, unknown>;
}

function describeErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ');
}

export class EventContracts {
  private constructor(
    private readonly validateEnvelope: ValidateFunction,
    private readonly service: ServiceContract | null,
  ) {}

  static forService(name: string, options: { required?: boolean } = {}): EventContracts {
    if (!isServiceName(name)) {
      throw new Error(`Cannot look up an event contract for service name "${name}"`);
    }
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateEnvelope = ajv.compile(
      readSchema('@netverse/contracts/events/v1/envelope.schema.json'),
    );
    try {
      const schema = readSchema(`@netverse/contracts/events/v1/${name}.schema.json`);
      const types = Array.isArray(schema['x-event-types']) ? schema['x-event-types'] : [];
      return new EventContracts(validateEnvelope, {
        types: new Set(types.filter((type): type is string => typeof type === 'string')),
        validateData: ajv.compile(schema),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
      if (options.required) {
        throw new Error(`no event contract is published for ${name}`, { cause: error });
      }
      return new EventContracts(validateEnvelope, null);
    }
  }

  assertValid(event: EventEnvelope): void {
    const envelopeIsValid: boolean = this.validateEnvelope(event);
    if (!envelopeIsValid) {
      throw new InvalidEventError(
        `Event ${event.id} breaks the envelope: ${describeErrors(this.validateEnvelope.errors)}`,
      );
    }
    if (!this.service) {
      return;
    }
    if (!this.service.types.has(event.type)) {
      throw new InvalidEventError(`Event type ${event.type} is not declared in the contract`);
    }
    const dataIsValid: boolean = this.service.validateData(event.data);
    if (!dataIsValid) {
      throw new InvalidEventError(
        `Event ${event.id} breaks the ${event.type} contract: ${describeErrors(this.service.validateData.errors)}`,
      );
    }
  }
}
