import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVICE_ROOT = join(__dirname, '..', '..');
const exported = readFileSync(join(SERVICE_ROOT, 'openapi.yaml'), 'utf8');
const published = readFileSync(
  require.resolve('@netverse/contracts/openapi/v1/media.yaml'),
  'utf8',
);

function normalize(text: string): string {
  return text.replaceAll('\r\n', '\n');
}

describe('hợp đồng HTTP của media', () => {
  it('bản trong packages/contracts trùng với bản service xuất ra', () => {
    expect(normalize(published)).toBe(normalize(exported));
  });

  it('khai theo OpenAPI 3.1 như mọi hợp đồng HTTP của hệ thống', () => {
    expect(normalize(exported).startsWith('openapi: 3.1.0\n')).toBe(true);
  });
});
