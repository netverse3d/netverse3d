import { readFileSync } from 'node:fs';

function normalized(file: string): string {
  return readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
}

export function describePublishedOpenApi(exportedFile: string, publishedFile: string): void {
  describe('hợp đồng HTTP đã công bố', () => {
    it('bản trong packages/contracts trùng với bản service xuất ra', () => {
      expect(normalized(publishedFile)).toBe(normalized(exportedFile));
    });

    it('khai theo OpenAPI 3.1 như mọi hợp đồng HTTP của hệ thống', () => {
      expect(normalized(exportedFile).startsWith('openapi: 3.1.0\n')).toBe(true);
    });
  });
}
