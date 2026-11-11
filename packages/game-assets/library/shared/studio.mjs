export function studioLights(THREE, scene, environment) {
  const key = new THREE.DirectionalLight('#fff4e6', 1.2);
  key.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight('#dbe6ff', 0.8);
  fill.position.set(-4, 2.5, 2);
  const rim = new THREE.DirectionalLight('#ffffff', 0.9);
  rim.position.set(-1, 3.5, -5);
  scene.add(key, fill, rim, new THREE.HemisphereLight('#ffffff', '#2a2a33', 0.7));
  scene.environment = environment;
  scene.environmentIntensity = 0.8;
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
