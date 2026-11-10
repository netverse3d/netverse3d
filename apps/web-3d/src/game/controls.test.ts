import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STICK_RADIUS_PIXELS, createControls } from './controls.ts';
import type { ControlSurface } from './controls.ts';
import { STILL } from './input.ts';

interface Stage {
  keys: EventTarget;
  surface: ControlSurface & EventTarget;
  captured: number[];
}

function stage(): Stage {
  const captured: number[] = [];
  const surface = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 100, width: 800 }),
    setPointerCapture: (pointerId: number) => {
      captured.push(pointerId);
    },
  });
  return { keys: new EventTarget(), surface, captured };
}

function key(type: string, code: string, target: object = {}): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  return Object.assign(event, { code });
}

function pointer(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType = 'mouse',
): Event {
  return Object.assign(new Event(type, { cancelable: true }), {
    pointerId,
    clientX,
    clientY,
    pointerType,
  });
}

test('giữ phím thì đi, nhả phím thì dừng', () => {
  const { keys, surface } = stage();
  const controls = createControls(surface, keys);
  keys.dispatchEvent(key('keydown', 'KeyW'));
  assert.equal(controls.intent().forward, 1);
  keys.dispatchEvent(key('keydown', 'ShiftLeft'));
  assert.equal(controls.intent().run, true);
  keys.dispatchEvent(key('keyup', 'KeyW'));
  assert.deepEqual(controls.intent(), STILL);
});

test('phím điều khiển bị chặn hành vi mặc định của trình duyệt, phím khác thì không', () => {
  const { keys, surface } = stage();
  createControls(surface, keys);
  const arrow = key('keydown', 'ArrowDown');
  const other = key('keydown', 'KeyQ');
  keys.dispatchEvent(arrow);
  keys.dispatchEvent(other);
  assert.equal(arrow.defaultPrevented, true);
  assert.equal(other.defaultPrevented, false);
});

test('đang gõ trong ô nhập hay ô chọn thì phím không điều khiển nhân vật', () => {
  const { keys, surface } = stage();
  const controls = createControls(surface, keys);
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) {
    const event = key('keydown', 'ArrowUp', { tagName });
    keys.dispatchEvent(event);
    assert.deepEqual(controls.intent(), STILL, tagName);
    assert.equal(event.defaultPrevented, false, tagName);
  }
});

test('cửa sổ mất tiêu điểm thì nhả hết phím, nhân vật không tự đi mãi', () => {
  const { keys, surface } = stage();
  const controls = createControls(surface, keys);
  keys.dispatchEvent(key('keydown', 'KeyD'));
  keys.dispatchEvent(new Event('blur'));
  assert.deepEqual(controls.intent(), STILL);
});

test('kéo chuột trên cảnh cộng dồn thành góc quay, lấy ra rồi thì về không', () => {
  const { surface, keys, captured } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 500, 300));
  surface.dispatchEvent(pointer('pointermove', 1, 520, 290));
  surface.dispatchEvent(pointer('pointermove', 1, 550, 310));
  assert.deepEqual(controls.takeTurn(), { right: 50, down: 10 });
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
  assert.deepEqual(captured, [1]);
  surface.dispatchEvent(pointer('pointerup', 1, 550, 310));
  surface.dispatchEvent(pointer('pointermove', 1, 700, 310));
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
});

test('rê chuột khi chưa nhấn thì không quay camera', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointermove', 1, 700, 310));
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
});

test('chạm nửa trái màn hình là cần ảo: đẩy lên là tiến, nhả tay là dừng', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 7, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 7, 200, 400 - STICK_RADIUS_PIXELS, 'touch'));
  const pushed = controls.intent();
  assert.ok(Math.abs(pushed.forward - 1) < 1e-9 && Math.abs(pushed.right) < 1e-9);
  assert.equal(pushed.run, true);
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
  surface.dispatchEvent(pointer('pointerup', 7, 200, 300, 'touch'));
  assert.deepEqual(controls.intent(), STILL);
});

test('chạm nửa phải màn hình là quay camera, dùng cùng lúc với cần ảo được', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 1, 200 + STICK_RADIUS_PIXELS / 2, 400, 'touch'));
  surface.dispatchEvent(pointer('pointerdown', 2, 700, 300, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 2, 730, 300, 'touch'));
  assert.ok(controls.intent().right > 0);
  assert.deepEqual(controls.takeTurn(), { right: 30, down: 0 });
});

test('cần ảo đang đẩy thì thắng bàn phím', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  keys.dispatchEvent(key('keydown', 'KeyS'));
  surface.dispatchEvent(pointer('pointerdown', 1, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 1, 200, 400 - STICK_RADIUS_PIXELS, 'touch'));
  assert.ok(controls.intent().forward > 0);
});

test('chạm bị hệ thống huỷ thì cần ảo nhả ra', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 1, 200, 300, 'touch'));
  surface.dispatchEvent(pointer('pointercancel', 1, 200, 300, 'touch'));
  assert.deepEqual(controls.intent(), STILL);
});

test('gỡ điều khiển thì không còn nghe phím hay chuột', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  controls.dispose();
  keys.dispatchEvent(key('keydown', 'KeyW'));
  surface.dispatchEvent(pointer('pointerdown', 1, 500, 300));
  surface.dispatchEvent(pointer('pointermove', 1, 600, 300));
  assert.deepEqual(controls.intent(), STILL);
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
});

test('nhả phím lúc tiêu điểm đang ở ô chọn thì phím vẫn được nhả', () => {
  const { keys, surface } = stage();
  const controls = createControls(surface, keys);
  keys.dispatchEvent(key('keydown', 'KeyW'));
  keys.dispatchEvent(key('keyup', 'KeyW', { tagName: 'SELECT' }));
  assert.deepEqual(controls.intent(), STILL);
});

test('tổ hợp với Ctrl, Alt hay Cmd là phím tắt của trình duyệt: không chặn, không đi, và nhả hết phím đang giữ', () => {
  const { keys, surface } = stage();
  const controls = createControls(surface, keys);
  keys.dispatchEvent(key('keydown', 'KeyW'));
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    const shortcut = Object.assign(key('keydown', 'KeyS'), { [modifier]: true });
    keys.dispatchEvent(shortcut);
    assert.equal(shortcut.defaultPrevented, false, modifier);
    assert.deepEqual(controls.intent(), STILL, modifier);
  }
});

test('cần ảo dùng lại được sau khi nhả tay', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  for (const pointerId of [1, 2]) {
    surface.dispatchEvent(pointer('pointerdown', pointerId, 200, 400, 'touch'));
    surface.dispatchEvent(
      pointer('pointermove', pointerId, 200 + STICK_RADIUS_PIXELS, 400, 'touch'),
    );
    assert.ok(controls.intent().right > 0.9, `touch ${pointerId}`);
    surface.dispatchEvent(pointer('pointerup', pointerId, 200, 400, 'touch'));
    assert.deepEqual(controls.intent(), STILL);
  }
});

test('ngón thứ hai chạm nửa trái không cướp cần ảo và không quay camera', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 1, 200, 400 - STICK_RADIUS_PIXELS, 'touch'));
  surface.dispatchEvent(pointer('pointerdown', 2, 300, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 2, 360, 500, 'touch'));
  assert.ok(controls.intent().forward > 0.9);
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
});

test('nửa trái tính theo vị trí khung cảnh trên trang, không theo mép cửa sổ', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 450, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 1, 450, 400 - STICK_RADIUS_PIXELS, 'touch'));
  assert.ok(controls.intent().forward > 0.9);
  surface.dispatchEvent(pointer('pointerdown', 2, 520, 300, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 2, 540, 300, 'touch'));
  assert.deepEqual(controls.takeTurn(), { right: 20, down: 0 });
});

test('chuột ở nửa trái vẫn là quay camera, không phải cần ảo', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 200, 300));
  surface.dispatchEvent(pointer('pointermove', 1, 240, 300));
  assert.deepEqual(controls.intent(), STILL);
  assert.deepEqual(controls.takeTurn(), { right: 40, down: 0 });
});

test('nút chuột phải không quay camera và không mở trình đơn của trình duyệt trên cảnh', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(Object.assign(pointer('pointerdown', 1, 500, 300), { button: 2 }));
  surface.dispatchEvent(pointer('pointermove', 1, 600, 300));
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
  const menu = new Event('contextmenu', { cancelable: true });
  surface.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, true);
});

test('lỡ mất sự kiện nhả chuột thì lần rê kế tiếp không còn quay camera', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 500, 300));
  surface.dispatchEvent(Object.assign(pointer('pointermove', 1, 510, 300), { buttons: 1 }));
  surface.dispatchEvent(Object.assign(pointer('pointermove', 1, 700, 300), { buttons: 0 }));
  surface.dispatchEvent(Object.assign(pointer('pointermove', 1, 900, 300), { buttons: 0 }));
  assert.deepEqual(controls.takeTurn(), { right: 10, down: 0 });
});

test('mất quyền giữ con trỏ hoặc cửa sổ mất tiêu điểm thì nhả cả cần ảo lẫn quay camera', () => {
  const { surface, keys } = stage();
  const controls = createControls(surface, keys);
  surface.dispatchEvent(pointer('pointerdown', 1, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 1, 200, 300, 'touch'));
  surface.dispatchEvent(pointer('lostpointercapture', 1, 200, 300, 'touch'));
  assert.deepEqual(controls.intent(), STILL);
  surface.dispatchEvent(pointer('pointerdown', 2, 700, 300, 'touch'));
  surface.dispatchEvent(pointer('pointerdown', 3, 200, 400, 'touch'));
  surface.dispatchEvent(pointer('pointermove', 3, 200, 300, 'touch'));
  keys.dispatchEvent(new Event('blur'));
  surface.dispatchEvent(pointer('pointermove', 2, 800, 300, 'touch'));
  assert.deepEqual(controls.intent(), STILL);
  assert.deepEqual(controls.takeTurn(), { right: 0, down: 0 });
});
