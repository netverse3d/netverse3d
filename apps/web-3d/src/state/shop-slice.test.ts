import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  errorRaised,
  initialShopState,
  isQualityLevel,
  qualityRequested,
  recipeRequested,
  sceneChanged,
  statsReported,
} from './shop-slice.ts';
import { createAppStore } from './store.ts';

test('số đo và trạng thái cảnh vào kho thành ảnh chụp mới, tuần tự hoá được', () => {
  const { store } = createAppStore();
  const before = store.getState().shop;
  store.dispatch(statsReported({ fps: 60, calls: 24, triangles: 1000 }));
  store.dispatch(sceneChanged({ ...before.scene, ready: true, frames: 1 }));
  const after = store.getState().shop;
  assert.notEqual(after, before);
  assert.equal(after.stats.fps, 60);
  assert.equal(after.scene.ready, true);
  assert.equal(after.scene.recipeId, before.scene.recipeId);
  assert.deepEqual(JSON.parse(JSON.stringify(after)), after);
});

test('lệnh từ giao diện không đổi kho, lớp ứng dụng nhận qua listener', () => {
  const { store, listener } = createAppStore();
  const received: string[] = [];
  const stop = listener.startListening({
    actionCreator: recipeRequested,
    effect: (action) => {
      received.push(action.payload);
    },
  });
  const before = store.getState().shop;
  store.dispatch(recipeRequested('cam-retro'));
  store.dispatch(qualityRequested('high'));
  assert.equal(store.getState().shop, before);
  assert.deepEqual(received, ['cam-retro']);
  stop();
  store.dispatch(recipeRequested('tim-neon'));
  assert.deepEqual(received, ['cam-retro']);
});

test('lỗi được giữ lại để giao diện hiện', () => {
  const { store } = createAppStore();
  store.dispatch(errorRaised('player.glb: HTTP 404'));
  assert.equal(store.getState().shop.error, 'player.glb: HTTP 404');
  assert.equal(initialShopState('bien-sau').scene.recipeId, 'bien-sau');
  assert.equal(isQualityLevel('ultra'), false);
});
