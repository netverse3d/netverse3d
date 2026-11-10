import type { AnimationAction, Object3D, SkinnedMesh } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createActorLook, type ActorLook } from '@netverse/game-assets/runtime/actor-look.mjs';
import type { PlayerState } from '@netverse/game-shared/movement';

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
const CLIP_BLEND_SECONDS = 0.18;
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
  let playing: AnimationAction | null = null;
  const playClip = (name: string) => {
    const next = actions.get(name) ?? null;
    if (!next || next === playing) return;
    next.reset().play();
    if (playing) next.crossFadeFrom(playing, CLIP_BLEND_SECONDS, false);
    playing = next;
  };
  playClip(IDLE_CLIP);
  return {
    root,
    hasFace: Boolean(root.userData.face?.map),
    moveTo(state) {
      root.position.set(state.x, 0, state.z);
      root.rotation.y = state.yaw;
    },
    playClip,
    update(delta) {
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
