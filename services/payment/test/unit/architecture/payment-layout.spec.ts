import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const sourceRoot = resolve(__dirname, '../../../src');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : entry.isFile() && entry.name.endsWith('.ts')
        ? [path]
        : [];
  });

describe('ranh giới cấu trúc payment', () => {
  it('dùng health module từ NestKit thay vì giữ module cục bộ', () => {
    const localHealthModule = resolve(__dirname, '../../../src/modules/health');

    expect(existsSync(localHealthModule)).toBe(false);
  });

  it('không giữ facade chỉ re-export NestKit', () => {
    const facades = sourceFiles(sourceRoot)
      .filter((path) =>
        /export\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*)\s+from\s+['"]@netverse\/nest-kit['"]|import\s+\{[^}]+\}\s+from\s+['"]@netverse\/nest-kit['"][\s\S]*?export\s+\{[^}]+\}\s*;?\s*$/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(sourceRoot, path).replaceAll('\\', '/'));

    expect(facades).toEqual([]);
  });

  it('không để helper theo miền trong common', () => {
    const commonHelpers = sourceFiles(resolve(sourceRoot, 'common'))
      .filter((path) => /[/\\](constants|context|decorators|utils)[/\\]/.test(path))
      .map((path) => relative(sourceRoot, path).replaceAll('\\', '/'));

    expect(commonHelpers).toEqual([]);
  });

  it('đặt helper dùng nhiều miền trong shared và giữ caller ở nhiều miền', () => {
    const sharedHelpers = ['hash.util', 'serialization.util', 'signature.util'];
    const moduleRoot = resolve(sourceRoot, 'modules');
    const callersFor = (helper: string): string[] =>
      sourceFiles(moduleRoot)
        .filter((path) => relative(moduleRoot, path).split(/[\\/]/)[0] !== 'shared')
        .filter((path) =>
          readFileSync(path, 'utf8').includes(`@app/modules/shared/utils/${helper}`),
        )
        .flatMap((path) => {
          const domain = relative(moduleRoot, path).split(/[\\/]/)[0];
          return domain && domain !== '..' ? [domain] : [];
        });

    for (const helper of sharedHelpers) {
      expect(new Set(callersFor(helper)).size).toBeGreaterThanOrEqual(2);
    }
  });
});
