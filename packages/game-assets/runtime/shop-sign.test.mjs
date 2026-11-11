import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { buildSign, paintSign, signPlacement, signStyle } from './shop-sign.mjs';

function recipe(door, cells = [4, 3], sign = { text: 'TÍM NEON', style: 'neon' }) {
  return {
    palette: { accent: ['#ff4fd8'] },
    layout: { cells, door, stations: [], windows: [] },
    sign,
  };
}

function recordingContext() {
  const calls = [];
  const context = { calls };
  for (const name of ['fillRect', 'fillText', 'clearRect']) {
    context[name] = (...args) => calls.push([name, ...args]);
  }
  return context;
}

function fakeCanvas() {
  const context = recordingContext();
  return { width: 0, height: 0, context, getContext: () => context };
}

test('biển hiệu nằm phía trên cửa, trước dải hắt sáng của trần nên không bị tường che', () => {
  assert.deepEqual(signPlacement(recipe({ wall: 'south', at: 1 })).position, [-1, 2.62, 2.5]);
  assert.deepEqual(signPlacement(recipe({ wall: 'north', at: 2 })).position, [1, 2.62, -2.5]);
  assert.deepEqual(signPlacement(recipe({ wall: 'east', at: 1 })).position, [3.5, 2.62, 0]);
  assert.deepEqual(signPlacement(recipe({ wall: 'west', at: 0 })).position, [-3.5, 2.62, -2]);
});

test('biển hiệu quay mặt chữ vào trong tiệm', () => {
  assert.equal(signPlacement(recipe({ wall: 'south', at: 1 })).yaw, Math.PI);
  assert.equal(signPlacement(recipe({ wall: 'north', at: 1 })).yaw, 2 * Math.PI);
  assert.equal(signPlacement(recipe({ wall: 'east', at: 1 })).yaw, (3 * Math.PI) / 2);
  assert.equal(signPlacement(recipe({ wall: 'west', at: 1 })).yaw, Math.PI / 2);
});

test('chữ trên biển lấy màu nhấn của tiệm trên nền tối; biển sơn có nền đặc và không toả sáng', () => {
  const neon = signStyle(recipe({ wall: 'south', at: 1 }));
  assert.deepEqual(neon, {
    text: 'TÍM NEON',
    color: '#ff4fd8',
    background: 'rgba(11, 8, 20, 0.85)',
    glow: 26,
    passes: 2,
  });
  const painted = signStyle(
    recipe({ wall: 'south', at: 1 }, [4, 3], { text: 'CAM RETRO', style: 'painted' }),
  );
  assert.equal(painted.background, '#1a1320');
  assert.equal(painted.glow, 0);
  const led = signStyle(
    recipe({ wall: 'south', at: 1 }, [4, 3], { text: 'BIỂN SÂU', style: 'led' }),
  );
  assert.equal(led.passes, 3);
});

test('biển không ghi kiểu thì vẽ kiểu neon', () => {
  const style = signStyle(recipe({ wall: 'south', at: 1 }, [4, 3], { text: 'TIỆM' }));
  assert.equal(style.glow, 26);
  assert.equal(style.passes, 2);
});

test('vẽ biển ghi đúng chữ của tiệm lên giữa tấm biển', () => {
  const canvas = fakeCanvas();
  paintSign(canvas, signStyle(recipe({ wall: 'south', at: 1 })));
  const texts = canvas.context.calls.filter(([name]) => name === 'fillText');
  assert.equal(texts.length, 2);
  assert.deepEqual(texts[0], ['fillText', 'TÍM NEON', 256, 68]);
  assert.equal(canvas.context.fillStyle, '#ff4fd8');
  assert.deepEqual([canvas.width, canvas.height], [512, 128]);
});

test('cảnh tiệm có một tấm biển đặt đúng chỗ, mang ảnh chữ vừa vẽ', () => {
  const canvas = fakeCanvas();
  const sign = buildSign(THREE, recipe({ wall: 'south', at: 1 }), canvas);
  assert.equal(sign.name, 'shop_sign');
  assert.deepEqual(sign.position.toArray(), [-1, 2.62, 2.5]);
  assert.equal(sign.rotation.y, Math.PI);
  assert.equal(sign.material.map.image, canvas);
  assert.equal(sign.material.toneMapped, false);
  assert.equal(canvas.context.calls.filter(([name]) => name === 'fillText').length, 2);
});

test('nền biển được tô trước chữ để chữ nổi trên dải sáng của trần', () => {
  const canvas = fakeCanvas();
  paintSign(canvas, signStyle(recipe({ wall: 'south', at: 1 })));
  const order = canvas.context.calls.map(([name]) => name);
  assert.deepEqual(order, ['clearRect', 'fillRect', 'fillText', 'fillText']);
  assert.deepEqual(canvas.context.calls[1], ['fillRect', 0, 0, 512, 128]);
});
