import type { AnimationAction, Object3D, SkinnedMesh } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  BACKPACK_NODE,
  createActorLook,
  wearsBackpack,
  type ActorLook,
} from '@netverse/game-assets/runtime/actor-look.mjs';
import type { PlayerState } from '@netverse/game-shared/movement';
import { blendClipWeights } from './clip-blend.ts';
import { createClipTrack } from './clip-track.ts';

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
const HAND_PROPS = ['crate', 'cup'];
const PLAYED_ONCE = ['sit_down', 'stand_up'];
let sharedLook: ActorLook | null = null;

export function createPlayer(THREE: Three, gltf: GLTF, spawn: Spawn): Player {
  sharedLook ??= createActorLook(THREE);
  const root = SkeletonUtils.clone(gltf.scene);
  sharedLook.dress(root);
  for (const name of HAND_PROPS) {
    const prop = root.getObjectByName(name);
    if (prop) prop.visible = false;
  }
  const backpack = root.getObjectByName(BACKPACK_NODE);
  root.position.set(spawn.x, 0, spawn.z);
  root.rotation.y = spawn.yaw;
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, AnimationAction>(
    gltf.animations.map((animation) => [animation.name, mixer.clipAction(animation)]),
  );
  for (const name of PLAYED_ONCE) {
    const once = actions.get(name);
    if (!once) continue;
    once.setLoop(THREE.LoopOnce, 1);
    once.clampWhenFinished = true;
  }
  const track = createClipTrack(actions.keys(), PLAYED_ONCE, IDLE_CLIP);
  let weights = new Map<string, number>();
  const blend = (delta: number) => {
    const active = weights;
    weights = blendClipWeights(weights, track.current(), delta);
    for (const [name, action] of actions) {
      const weight = weights.get(name);
      if (weight === undefined) {
        if (action.isRunning()) action.stop();
      } else {
        if (track.takeRestart(name) || !active.has(name)) action.reset().play();
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
      track.select(name);
    },
    update(delta) {
      if (backpack) backpack.visible = wearsBackpack(track.current());
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
