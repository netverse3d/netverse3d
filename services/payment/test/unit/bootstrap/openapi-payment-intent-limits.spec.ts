import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

interface SchemaProperty {
  minimum?: number;
  maximum?: number;
}

interface OpenApiDocument {
  components: {
    schemas: Record<string, { properties: Record<string, SchemaProperty> }>;
  };
}

const document = load(readFileSync('openapi.yaml', 'utf8')) as OpenApiDocument;
const schema = document.components.schemas.CreatePaymentIntentDto;
if (!schema) throw new Error('CreatePaymentIntentDto is missing from OpenAPI');
const properties = schema.properties;

describe('OpenAPI payment amount limits', () => {
  it.each([
    ['subtotalMinor', 1],
    ['discountMinor', 0],
    ['feeMinor', 0],
    ['taxMinor', 0],
  ])('%s công bố khoảng số tiền an toàn', (property, minimum) => {
    expect(properties[property]).toMatchObject({ minimum, maximum: Number.MAX_SAFE_INTEGER });
  });
});
