import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkModuleCss, checkScreenSource } from './lib.mjs';

const registered = new Set(['Button', 'Dialog', 'TextField']);
const screen = (source) => checkScreenSource(source, 'src/ui/screen.tsx', registered);

test('nút tự dựng trong màn hình bị chặn', () => {
  assert.equal(screen('export const A = () => <button onClick={go}>Vào</button>;').length, 1);
  assert.equal(screen('const B = () => <div role="dialog"><input name="x" /></div>;').length, 1);
});

test('thẻ cấu trúc và component đã đăng ký được phép', () => {
  const source = [
    "import { Button, Dialog } from '@netverse/ui/react';",
    'export const C = () => (',
    '  <section>',
    '    <Dialog open title="a" titleId="b" closeLabel="c" onClose={close}>',
    '      <form><p><Button type="submit">OK</Button></p></form>',
    '    </Dialog>',
    '  </section>',
    ');',
  ].join('\n');
  assert.deepEqual(screen(source), []);
});

test('kiểu generic TypeScript không bị hiểu nhầm là thẻ JSX', () => {
  const source =
    'type P = { prompt(): Promise<unknown> };\nconst r = useRef<string>(null);\nconst x = a <b;';
  assert.deepEqual(screen(source), []);
});

test('import component chưa đăng ký bị chặn', () => {
  const violations = screen("import { FancyButton } from '@netverse/ui/react';");
  assert.equal(violations.length, 1);
  assert.match(violations[0], /FancyButton/);
});

test('import sâu vào bên trong gói ui bị chặn', () => {
  assert.equal(screen("import { Button } from '@netverse/ui/react/actions.tsx';").length, 1);
});

test('style nội tuyến và class nv tự gắn bị chặn', () => {
  assert.equal(screen('const D = () => <div style={{ color: "red" }} />;').length, 1);
  assert.equal(screen('const E = () => <div className="nv-shape nv-button" />;').length, 1);
});

test('CSS của màn hình chỉ được dàn trang', () => {
  const layout =
    '.bar {\n  position: absolute;\n  top: var(--ui-space-3);\n  display: grid;\n  gap: var(--ui-space-2);\n  z-index: var(--ui-layer-chrome);\n}\n';
  assert.deepEqual(checkModuleCss(layout, 'x.module.css'), []);
  const visual =
    '.bar {\n  background: var(--ui-panel);\n  border-radius: var(--ui-radius-2);\n  color: var(--ui-text);\n}\n';
  assert.equal(checkModuleCss(visual, 'x.module.css').length, 3);
});

test('lớp z của màn hình phải dùng token lớp', () => {
  assert.equal(checkModuleCss('.a {\n  z-index: 12;\n}\n', 'x.module.css').length, 1);
});
