import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyLighting } from '../../runtime/lighting.mjs';

const studioEnvironments = new WeakMap();

export function studioLights(THREE, scene, renderer) {
  const sharedEnvironment = studioEnvironments.get(renderer);
  const handle = applyLighting(THREE, {
    scene,
    renderer,
    preset: 'studio',
    RoomEnvironment,
    environmentTexture: sharedEnvironment?.envTexture,
  });
  if (!sharedEnvironment) studioEnvironments.set(renderer, handle);
  return handle;
}

export function triangleCount(object) {
  let total = 0;
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    total += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  });
  return Math.round(total);
}

export function aimCamera(camera, controls, view) {
  camera.position.set(...view.eye);
  controls.target.set(...view.target);
  controls.update();
}

export function fitRenderer(renderer, camera, host) {
  const { clientWidth, clientHeight } = host;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(clientHeight, 1);
  camera.updateProjectionMatrix();
}
