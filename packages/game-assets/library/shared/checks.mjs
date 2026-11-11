import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BACKPACK_NODE, createActorLook, wearsBackpack } from '../../runtime/actor-look.mjs';
import { legendTextures } from '../../runtime/keyboard-legends.mjs';
import { kitAnchors, paletteRows, stationPlan } from '../../runtime/shop-look.mjs';
import { buildShop, kitLightmap, shopMaterials } from '../../runtime/three-shop.mjs';
import {
  STATION_KIT,
  clearance,
  collisionOutlines,
  handReading,
  seatedClips,
  seatPoint,
  stationChoices,
  withVariant,
} from './checks-data.mjs';
import { element, loadShell, mountPageHead, readJson } from './shell.mjs';
import { studioLights } from './studio.mjs';

const SECTION_ID = 'checks';
const PACKAGE_ROOT = new URL('../../', import.meta.url);
const SEAT_ANCHOR = 'seat_anchor';
const HAND_BONES = ['handL', 'handR'];
const TOE_BONES = ['toeL', 'toeR'];
const HAND_PROPS = ['crate', 'cup'];
const FOOT_REACH = 0.09;
const KEYBOARD_MARGIN = 0.03;
const VIEWS = {
  iso: { eye: [1.6, 1.6, -1.6], target: [0, 0.75, 0.25] },
  side: { eye: [2.6, 0.9, 0.15], target: [0, 0.7, 0.15] },
  front: { eye: [0, 1.25, 2.6], target: [0, 0.8, 0.2] },
  top: { eye: [0, 3.2, 0.14], target: [0, 0.7, 0.15] },
  hands: { eye: [0.85, 0.87, 0.16], target: [0, 0.75, 0.27] },
  feet: { eye: [1.0, 0.3, -0.55], target: [0, 0.15, 0.3] },
};
const byId = (id) => document.getElementById(id);

function gltfJson(gltf) {
  return gltf.parser.json;
}

function disposeMaterials(materials) {
  for (const material of Object.values(materials)) {
    material.map?.dispose();
    material.emissiveMap?.dispose();
    material.dispose();
  }
}

function topOf(kitScene, part) {
  const source = kitScene.getObjectByName(part);
  source.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(source);
  const origin = new THREE.Vector3().setFromMatrixPosition(source.matrixWorld);
  return {
    top: box.max.y - origin.y,
    halfWidth: (box.max.x - box.min.x) / 2,
    halfDepth: (box.max.z - box.min.z) / 2,
  };
}

async function main() {
  const shell = await loadShell();
  mountPageHead(shell, SECTION_ID);
  const words = shell.text.checks;

  const canvas = byId('gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    byId('status').hidden = true;
    byId('no-webgl').hidden = false;
    document.body.dataset.ready = 'failed';
    return;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor('#141026');

  const loader = new GLTFLoader();
  const [config, recipeIds, keyboards, kit, actor] = await Promise.all([
    readJson(new URL('assets.config.json', PACKAGE_ROOT)),
    readJson(new URL('recipes/index.json', PACKAGE_ROOT)),
    readJson(new URL('keyboards.json', PACKAGE_ROOT)),
    loader.loadAsync(new URL(`exported/${STATION_KIT}`, PACKAGE_ROOT).href),
    loader.loadAsync(new URL('exported/player.glb', PACKAGE_ROOT).href),
  ]);
  const recipes = Object.fromEntries(
    await Promise.all(
      recipeIds.map(async (id) => [
        id,
        await readJson(new URL(`recipes/${id}.json`, PACKAGE_ROOT)),
      ]),
    ),
  );
  const anchors = kitAnchors(gltfJson(kit));
  const rows = paletteRows(config.palette);
  const choices = stationChoices(config);
  const clips = seatedClips(actor.animations.map((animation) => animation.name));

  const scene = new THREE.Scene();
  studioLights(
    THREE,
    scene,
    new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture,
  );
  const floor = new THREE.GridHelper(6, 12, '#3b3160', '#2a2244');
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 0.25;
  controls.maxDistance = 9;

  const query = new URLSearchParams(window.location.search);
  const startRecipe = recipeIds.includes(query.get('recipe')) ? query.get('recipe') : recipeIds[0];
  const state = {
    recipeId: startRecipe,
    variants: Object.fromEntries(
      choices.map(({ slot, variants }) => {
        const asked = query.get(slot);
        return [slot, variants.includes(asked) ? asked : recipes[startRecipe].variants[slot]];
      }),
    ),
    clip: clips.includes(query.get('clip')) ? query.get('clip') : clips[0],
    view: VIEWS[query.get('view')] ? query.get('view') : 'iso',
    playing: query.get('play') !== '0',
    show: { actor: true, boxes: false, anchors: false, bones: false },
  };

  const look = createActorLook(THREE);
  const figure = actor.scene;
  look.dress(figure);
  for (const name of HAND_PROPS) {
    const prop = figure.getObjectByName(name);
    if (prop) prop.visible = false;
  }
  scene.add(figure);
  const mixer = new THREE.AnimationMixer(figure);
  const actions = new Map(
    actor.animations.map((animation) => [animation.name, mixer.clipAction(animation)]),
  );
  const skeleton = new THREE.SkeletonHelper(figure);
  skeleton.visible = false;
  scene.add(skeleton);
  const bones = Object.fromEntries(
    [...HAND_BONES, ...TOE_BONES].map((name) => [name, figure.getObjectByName(name)]),
  );

  let station = null;
  let materials = null;
  let surfaces = null;
  const overlays = { boxes: new THREE.Group(), anchors: new THREE.Group() };
  scene.add(overlays.boxes, overlays.anchors);

  function drawOverlays(plan, seat) {
    overlays.boxes.clear();
    overlays.anchors.clear();
    for (const box of collisionOutlines(plan, anchors)) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(
          new THREE.BoxGeometry(box.half[0] * 2, box.half[1] * 2, box.half[2] * 2),
        ),
        new THREE.LineBasicMaterial({ color: '#ffb347' }),
      );
      edges.position.set(...box.center);
      edges.rotation.y = box.yaw;
      overlays.boxes.add(edges);
    }
    for (const placed of plan) {
      const marker = new THREE.AxesHelper(0.07);
      marker.position.set(...placed.position);
      overlays.anchors.add(marker);
    }
    const seatMarker = new THREE.AxesHelper(0.16);
    seatMarker.position.set(seat.x, 0.002, seat.z);
    overlays.anchors.add(seatMarker);
  }

  function rebuild() {
    if (station) {
      scene.remove(station);
      station.traverse((mesh) => mesh.dispose?.());
    }
    if (materials) disposeMaterials(materials);
    const recipe = recipes[state.recipeId];
    const plan = stationPlan(state.variants, anchors).map((placed) => ({ ...placed, yaw: 0 }));
    materials = shopMaterials(THREE, recipe, rows, {
      glowBoost: 1.1,
      lightmap: kitLightmap(kit.scene),
      legends: legendTextures(THREE, keyboards, recipe),
    });
    station = buildShop(THREE, kit.scene, plan, materials);
    scene.add(station);
    const chair = plan.find((placed) => placed.slot === 'chair');
    const seat = seatPoint(chair, anchors[chair.part][SEAT_ANCHOR]);
    figure.position.set(seat.x, 0, seat.z);
    figure.rotation.y = seat.yaw;
    const keyboard = plan.find((placed) => placed.slot === 'keyboard');
    const keys = topOf(kit.scene, keyboard.part);
    surfaces = {
      keyboard: {
        height: keyboard.position[1] + keys.top,
        x: keyboard.position[0],
        z: keyboard.position[2],
        halfWidth: keys.halfWidth + KEYBOARD_MARGIN,
        halfDepth: keys.halfDepth + KEYBOARD_MARGIN,
      },
      desk: plan.find((placed) => placed.slot === 'mat').position[1],
    };
    drawOverlays(plan, seat);
  }

  function playClip() {
    for (const [name, action] of actions) {
      if (name === state.clip) action.reset().play();
      else action.stop();
    }
    mixer.timeScale = state.playing ? 1 : 0;
    const backpack = figure.getObjectByName(BACKPACK_NODE);
    if (backpack) backpack.visible = wearsBackpack(state.clip);
  }

  function lookFrom(name) {
    const view = VIEWS[name];
    camera.position.set(...view.eye);
    controls.target.set(...view.target);
    controls.update();
  }

  const point = new THREE.Vector3();
  const rowsOfFindings = new Map();
  function measure() {
    for (const name of HAND_BONES) {
      bones[name].getWorldPosition(point);
      const reading = handReading(point, surfaces.keyboard, surfaces.desk);
      report(name, reading.surface, reading);
    }
    for (const name of TOE_BONES) {
      bones[name].getWorldPosition(point);
      report(name, 'floor', clearance(point.y, 0, FOOT_REACH));
    }
  }

  function report(name, surface, result) {
    const row = rowsOfFindings.get(name);
    row.dataset.level = result.level;
    if (result.millimetres === null) {
      row.lastChild.textContent = words.levels[result.level];
      return;
    }
    const side = result.millimetres < 0 ? words.below : words.above;
    row.lastChild.textContent = `${words.levels[result.level]} · ${Math.abs(result.millimetres)} ${words.unit} ${side} ${words.surfaces[surface]}`;
  }

  byId('findings').replaceChildren(
    ...[...HAND_BONES, ...TOE_BONES].map((name) => {
      const row = element('li', { class: 'finding' }, [
        element('b', {}, words.points[name]),
        element('span', {}, ''),
      ]);
      rowsOfFindings.set(name, row);
      return row;
    }),
  );

  function remember() {
    const params = new URLSearchParams();
    params.set('recipe', state.recipeId);
    for (const [slot, variant] of Object.entries(state.variants)) params.set(slot, variant);
    params.set('clip', state.clip);
    params.set('view', state.view);
    if (!state.playing) params.set('play', '0');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }

  function select(options, value, onChange) {
    const node = element(
      'select',
      {},
      options.map(([id, label]) => element('option', { value: id }, label)),
    );
    node.value = value;
    node.addEventListener('change', () => onChange(node.value));
    return node;
  }

  function field(label, control) {
    return element('label', { class: 'field' }, [element('span', {}, label), control]);
  }

  const slotSelects = new Map();
  byId('recipe-field').replaceChildren(
    field(
      byId('recipe-field').dataset.label,
      select(
        recipeIds.map((id) => [id, recipes[id].name]),
        state.recipeId,
        (id) => {
          state.recipeId = id;
          for (const { slot } of choices) {
            state.variants = withVariant(state.variants, slot, recipes[id].variants[slot]);
            slotSelects.get(slot).value = state.variants[slot];
          }
          rebuild();
          remember();
        },
      ),
    ),
  );
  byId('slots').replaceChildren(
    ...choices.map(({ slot, variants }) => {
      const control = select(
        variants.map((variant) => [variant, `${slot}_${variant}`]),
        state.variants[slot],
        (variant) => {
          state.variants = withVariant(state.variants, slot, variant);
          rebuild();
          remember();
        },
      );
      slotSelects.set(slot, control);
      return field(words.slots[slot] ?? slot, control);
    }),
  );
  byId('clip-field').replaceChildren(
    field(
      byId('clip-field').dataset.label,
      select(
        clips.map((name) => [name, words.clips[name] ?? name]),
        state.clip,
        (name) => {
          state.clip = name;
          playClip();
          remember();
        },
      ),
    ),
  );

  const playButton = byId('play');
  playButton.setAttribute('aria-pressed', String(state.playing));
  playButton.addEventListener('click', () => {
    state.playing = !state.playing;
    playButton.setAttribute('aria-pressed', String(state.playing));
    mixer.timeScale = state.playing ? 1 : 0;
    remember();
  });

  function drawViews() {
    byId('views').replaceChildren(
      ...Object.keys(VIEWS).map((name) => {
        const chip = element(
          'button',
          { class: 'chip', type: 'button', 'aria-pressed': String(state.view === name) },
          words.views[name],
        );
        chip.addEventListener('click', () => {
          state.view = name;
          lookFrom(name);
          drawViews();
          remember();
        });
        return chip;
      }),
    );
  }

  for (const chip of document.querySelectorAll('[data-show]')) {
    const key = chip.dataset.show;
    chip.setAttribute('aria-pressed', String(state.show[key]));
    chip.addEventListener('click', () => {
      state.show[key] = !state.show[key];
      chip.setAttribute('aria-pressed', String(state.show[key]));
    });
  }

  const view = byId('view');
  function resize() {
    const { clientWidth, clientHeight } = view;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);

  rebuild();
  playClip();
  drawViews();
  lookFrom(state.view);
  resize();
  byId('status').hidden = true;
  byId('bench').hidden = false;
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    mixer.update(clock.getDelta());
    figure.visible = state.show.actor;
    skeleton.visible = state.show.bones && state.show.actor;
    overlays.boxes.visible = state.show.boxes;
    overlays.anchors.visible = state.show.anchors;
    controls.update();
    figure.updateWorldMatrix(true, true);
    measure();
    renderer.render(scene, camera);
  });
  document.body.dataset.ready = 'true';
}

main().catch((reason) => {
  console.error(reason);
  document.body.dataset.ready = 'failed';
  byId('status').hidden = true;
  byId('problem').hidden = false;
});
