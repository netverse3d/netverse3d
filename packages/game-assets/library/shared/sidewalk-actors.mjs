import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const PLAYER_BONES = {
  upperArmL: 'upperL',
  upperArmR: 'upperR',
  foreArmL: 'foreL',
  foreArmR: 'foreR',
};
const STREET_CLIPS = ['idle', 'walk'];
const ACCESSORIES = ['backpack', 'cup', 'crate', 'glasses', 'headset'];

export function botClips(bot, player) {
  const bindings = new Map();
  bot.scene.traverse((target) => {
    if (!target.isBone) return;
    const source = player.scene.getObjectByName(PLAYER_BONES[target.name] ?? target.name);
    if (!source?.isBone) return;
    const basis = target
      .getWorldQuaternion(new THREE.Quaternion())
      .invert()
      .multiply(source.getWorldQuaternion(new THREE.Quaternion()));
    bindings.set(source.name, {
      name: target.name,
      basis,
      inverseBasis: basis.clone().invert(),
      sourceRest: source.quaternion.clone().invert(),
      targetRest: target.quaternion.clone(),
    });
  });

  const rotation = new THREE.Quaternion();
  return STREET_CLIPS.map((name) => {
    const clip = THREE.AnimationClip.findByName(player.animations, name);
    const tracks = clip.tracks.flatMap((track) => {
      const binding = bindings.get(track.name.replace(/\.quaternion$/, ''));
      if (!binding || track.ValueTypeName !== 'quaternion') return [];
      const { sourceRest, targetRest, basis, inverseBasis } = binding;
      const values = track.values.slice();
      for (let index = 0; index < values.length; index += 4) {
        rotation
          .fromArray(values, index)
          .premultiply(sourceRest)
          .premultiply(basis)
          .multiply(inverseBasis)
          .premultiply(targetRest)
          .normalize()
          .toArray(values, index);
      }
      return [new THREE.QuaternionKeyframeTrack(binding.name + '.quaternion', track.times, values)];
    });
    return new THREE.AnimationClip(name, clip.duration, tracks);
  });
}

export function createStreetActor(model, clips) {
  const root = clone(model.scene);
  for (const name of ACCESSORIES) {
    const node = root.getObjectByName(name);
    if (node) node.visible = false;
  }
  const mixer = new THREE.AnimationMixer(root);
  const idle = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'idle')).play();
  const walk = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'walk')).play();
  let weight = 0;
  walk.setEffectiveWeight(weight);
  return {
    root,
    update({ x, y, z, yaw, walking }, delta) {
      root.position.set(x, y, z);
      root.rotation.y +=
        Math.atan2(Math.sin(yaw - root.rotation.y), Math.cos(yaw - root.rotation.y)) *
        (1 - Math.exp(-18 * delta));
      weight += (Number(walking) - weight) * (1 - Math.exp(-15 * delta));
      idle.setEffectiveWeight(1 - weight);
      walk.setEffectiveWeight(weight);
      mixer.update(delta);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.traverse((node) => {
        if (node.isSkinnedMesh) node.skeleton.dispose();
      });
      root.removeFromParent();
    },
  };
}
