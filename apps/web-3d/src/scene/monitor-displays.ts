import * as THREE from 'three';
import type { Seat } from '../game/seats.ts';

type MonitorSeat = Pick<Seat, 'seatId' | 'monitor'>;

export function setActiveMonitorScreens(
  group: THREE.Object3D,
  seats: readonly MonitorSeat[],
  activeSeatId: string | null,
): void {
  const activeMonitor = seats.find((seat) => seat.seatId === activeSeatId)?.monitor ?? null;
  const inactiveColor = new THREE.Color('#070912');
  const activeColor = new THREE.Color('#168fff').multiplyScalar(2.5);
  group.traverse((object) => {
    const screen = object as THREE.InstancedMesh;
    if (
      !screen.isInstancedMesh ||
      screen.userData.material !== 'display' ||
      typeof screen.userData.part !== 'string' ||
      !screen.userData.part.startsWith('monitor_')
    ) {
      return;
    }
    for (let index = 0; index < screen.count; index += 1) {
      const selected =
        activeMonitor?.part === screen.userData.part && activeMonitor.index === index;
      screen.setColorAt(index, selected ? activeColor : inactiveColor);
    }
    if (screen.instanceColor) screen.instanceColor.needsUpdate = true;
  });
}
