import type { Object3D } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createActorLook, type ActorLook } from '@netverse/game-assets/runtime/actor-look.mjs';

type Three = typeof import('three');

export interface Spawn {
  x: number;
  z: number;
  yaw: number;
}

export interface Player {
  root: Object3D;
  yaw: number;
  hasFace: boolean;
  update(delta: number): void;
  dispose(): void;
}

const IDLE_CLIP = 'idle';
let sharedLook: ActorLook | null = null;

export function createPlayer(THREE: Three, gltf: GLTF, spawn: Spawn): Player {
  sharedLook ??= createActorLook(THREE);
  const root = SkeletonUtils.clone(gltf.scene);
  sharedLook.dress(root);
  root.position.set(spawn.x, 0, spawn.z);
  root.rotation.y = spawn.yaw;
  const mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find((animation) => animation.name === IDLE_CLIP);
  if (clip) mixer.clipAction(clip).play();
  return {
    root,
    yaw: spawn.yaw,
    hasFace: Boolean(root.userData.face?.map),
    update(delta) {
      mixer.update(delta);
    },
    dispose() {
      mixer.stopAllAction();
    },
  };
}
