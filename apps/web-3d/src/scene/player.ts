import type { AnimationAction, Object3D, SkinnedMesh } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createActorLook, type ActorLook } from '@netverse/game-assets/runtime/actor-look.mjs';
import type { PlayerState } from '@netverse/game-shared/movement';
import { blendClipWeights } from './clip-blend.ts';

type Three = typeof import('three');

export interface Spawn {
  x: number;
  z: number;
  yaw: number;
}

export interface Player {
  root: Object3D;
  hasFace: boolean;
  moveTo(state: PlayerState): void;
  playClip(name: string): void;
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
  const actions = new Map<string, AnimationAction>(
    gltf.animations.map((animation) => [animation.name, mixer.clipAction(animation)]),
  );
  let clip = IDLE_CLIP;
  let weights = new Map<string, number>();
  const blend = (delta: number) => {
    weights = blendClipWeights(weights, clip, delta);
    for (const [name, action] of actions) {
      const weight = weights.get(name);
      if (weight === undefined) {
        if (action.isRunning()) action.stop();
      } else {
        if (!action.isRunning()) action.play();
        action.setEffectiveWeight(weight);
      }
    }
  };
  blend(0);
  return {
    root,
    hasFace: Boolean(root.userData.face?.map),
    moveTo(state) {
      root.position.set(state.x, 0, state.z);
      root.rotation.y = state.yaw;
    },
    playClip(name) {
      if (actions.has(name)) clip = name;
    },
    update(delta) {
      blend(delta);
      mixer.update(delta);
    },
    dispose() {
      mixer.stopAllAction();
      root.traverse((object) => {
        const skinned = object as SkinnedMesh;
        if (skinned.isSkinnedMesh) skinned.skeleton.dispose();
      });
    },
  };
}
