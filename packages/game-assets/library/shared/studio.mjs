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
