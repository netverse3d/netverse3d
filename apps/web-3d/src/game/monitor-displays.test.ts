import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import * as displays from './monitor-displays.ts';

test('chỉ màn hình của máy đang thuê phát sáng, các màn hình còn lại tắt', () => {
  const update = Reflect.get(displays, 'setActiveMonitorScreens') as
    | ((
        group: THREE.Group,
        seats: { seatId: string; monitor: { part: string; index: number } }[],
        activeSeatId: string | null,
      ) => void)
    | undefined;
  assert.equal(typeof update, 'function');
  if (!update) return;
  const screen = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    3,
  );
  screen.userData.part = 'monitor_a';
  screen.userData.material = 'display';
  const group = new THREE.Group();
  group.add(screen);
  update(
    group,
    [
      { seatId: 'seat-1', monitor: { part: 'monitor_a', index: 0 } },
      { seatId: 'seat-2', monitor: { part: 'monitor_a', index: 1 } },
      { seatId: 'seat-3', monitor: { part: 'monitor_a', index: 2 } },
    ],
    'seat-2',
  );
  const colors = [0, 1, 2].map((index) => {
    const color = new THREE.Color();
    screen.getColorAt(index, color);
    return color;
  });
  assert.ok(colors[1]!.r > colors[0]!.r);
  assert.ok(colors[1]!.g > colors[2]!.g);
  assert.deepEqual(colors[0]!.toArray(), colors[2]!.toArray());
});
