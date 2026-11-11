import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BACKPACK_NODE, createActorLook, wearsBackpack } from '../../runtime/actor-look.mjs';
import {
  HAND_PROP_NODES,
  clipGroups,
  expressionClip,
  faceFor,
  handPropFor,
  meshBudgets,
} from './characters-data.mjs';
import { budgetUse } from './parts-data.mjs';
import { element, loadShell, mountPageHead, readJson } from './shell.mjs';
import { aimCamera, fitRenderer, studioLights, triangleCount } from './studio.mjs';

const SECTION_ID = 'characters';
const PACKAGE_ROOT = new URL('../../', import.meta.url);
const WEARABLES = ['glasses', 'headset', BACKPACK_NODE];
const VIEWS = {
  front: { eye: [0, 0.9, 3.9], target: [0, 0.72, 0] },
  side: { eye: [3.9, 0.9, 0], target: [0, 0.72, 0] },
  back: { eye: [0, 0.9, -3.9], target: [0, 0.72, 0] },
  face: { eye: [0.35, 1.25, 1.25], target: [0, 1.12, 0] },
};
const byId = (id) => document.getElementById(id);
const count = (value) => value.toLocaleString('vi-VN');

function createFigure(gltf, look) {
  const root = gltf.scene;
  look.dress(root);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map(
    gltf.animations.map((animation) => [animation.name, mixer.clipAction(animation)]),
  );
  const skeleton = new THREE.SkeletonHelper(root);
  return { root, mixer, actions, skeleton };
}

async function main() {
  const shell = await loadShell();
  mountPageHead(shell, SECTION_ID);
  const words = shell.text.characters;

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

  const config = await readJson(new URL('assets.config.json', PACKAGE_ROOT));
  const loader = new GLTFLoader();
  const [full, light] = await Promise.all([
    loader.loadAsync(new URL(`exported/${config.character.file}`, PACKAGE_ROOT).href),
    loader.loadAsync(new URL(`exported/${config.character.lodFile}`, PACKAGE_ROOT).href),
  ]);
  const look = createActorLook(THREE);
  const figures = { full: createFigure(full, look), light: createFigure(light, look) };
  const groups = clipGroups(config.clips);

  const scene = new THREE.Scene();
  studioLights(
    THREE,
    scene,
    new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture,
  );
  scene.add(new THREE.GridHelper(6, 12, '#3b3160', '#2a2244'));
  for (const figure of Object.values(figures)) scene.add(figure.root, figure.skeleton);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 0.4;
  controls.maxDistance = 9;

  const query = new URLSearchParams(window.location.search);
  const state = {
    clip: config.clips.includes(query.get('clip')) ? query.get('clip') : groups.actions[0],
    view: VIEWS[query.get('view')] ? query.get('view') : 'front',
    playing: query.get('play') !== '0',
    light: query.get('lod') === '1',
    bones: false,
    worn: Object.fromEntries(WEARABLES.map((name) => [name, true])),
  };

  function dress() {
    for (const [key, figure] of Object.entries(figures)) {
      const shown = (key === 'light') === state.light;
      figure.root.visible = shown;
      figure.skeleton.visible = shown && state.bones;
      for (const name of WEARABLES) {
        const node = figure.root.getObjectByName(name);
        if (!node) continue;
        const seated = name === BACKPACK_NODE && !wearsBackpack(state.clip);
        node.visible = state.worn[name] && !seated;
      }
      for (const name of HAND_PROP_NODES) {
        const node = figure.root.getObjectByName(name);
        if (node) node.visible = handPropFor(state.clip) === name;
      }
    }
  }

  function play() {
    for (const figure of Object.values(figures)) {
      for (const [name, action] of figure.actions) {
        if (name === state.clip) action.reset().play();
        else action.stop();
      }
      figure.mixer.timeScale = state.playing ? 1 : 0;
      look.showFace(figure.root, faceFor(state.clip));
    }
    dress();
  }

  function remember() {
    const params = new URLSearchParams();
    params.set('clip', state.clip);
    params.set('view', state.view);
    if (!state.playing) params.set('play', '0');
    if (state.light) params.set('lod', '1');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }

  function chips(target, items, isCurrent, onPick) {
    target.replaceChildren(
      ...items.map(([id, label]) => {
        const chip = element(
          'button',
          { class: 'chip', type: 'button', 'aria-pressed': String(isCurrent(id)) },
          label,
        );
        chip.addEventListener('click', () => onPick(id));
        return chip;
      }),
    );
  }

  function drawClips() {
    const pick = (clip) => {
      state.clip = clip;
      play();
      drawClips();
      remember();
    };
    chips(
      byId('actions'),
      groups.actions.map((name) => [name, words.actions[name] ?? name]),
      (name) => state.clip === name,
      pick,
    );
    chips(
      byId('expressions'),
      groups.expressions.map((name) => [expressionClip(name), words.expressions[name] ?? name]),
      (clip) => state.clip === clip,
      pick,
    );
  }

  function drawViews() {
    chips(
      byId('views'),
      Object.keys(VIEWS).map((name) => [name, words.views[name]]),
      (name) => state.view === name,
      (name) => {
        state.view = name;
        aimCamera(camera, controls, VIEWS[name]);
        drawViews();
        remember();
      },
    );
  }

  function drawToggles() {
    const items = [
      ...WEARABLES.map((name) => [name, words.meshes[name] ?? name]),
      ['bones', words.bones],
      ['light', words.light],
      ['playing', words.playing],
    ];
    const isOn = (id) => (WEARABLES.includes(id) ? state.worn[id] : state[id]);
    chips(byId('toggles'), items, isOn, (id) => {
      if (WEARABLES.includes(id)) state.worn[id] = !state.worn[id];
      else state[id] = !state[id];
      for (const figure of Object.values(figures)) figure.mixer.timeScale = state.playing ? 1 : 0;
      dress();
      drawToggles();
      drawBudgets();
      remember();
    });
  }

  function drawBudgets() {
    const shown = state.light ? figures.light : figures.full;
    byId('budgets').replaceChildren(
      ...meshBudgets(config).map((mesh) => {
        const node = shown.root.getObjectByName(mesh.name);
        const limit = state.light && mesh.lodTriangles ? mesh.lodTriangles : mesh.maxTriangles;
        const used = node ? triangleCount(node) : 0;
        const use = budgetUse(used, limit);
        const fill = element('i', {});
        fill.style.width = `${Math.round(use.ratio * 100)}%`;
        return element('li', { class: 'budget', 'data-level': use.level }, [
          element('span', { class: 'budget-name' }, words.meshes[mesh.name] ?? mesh.name),
          element('span', { class: 'budget-bar' }, fill),
          element(
            'span',
            { class: 'budget-text' },
            `${count(used)} / ${count(limit)} ${words.triangles}`,
          ),
        ]);
      }),
    );
    byId('totals').textContent =
      `${count(triangleCount(shown.root))} ${words.triangles} · ${count(config.bones.length)} ${words.boneCount} · ${count(groups.actions.length)} ${words.actionCount} · ${count(groups.expressions.length)} ${words.expressionCount}`;
  }

  const view = byId('view');
  const resize = () => fitRenderer(renderer, camera, view);
  new ResizeObserver(resize).observe(view);

  byId('status').hidden = true;
  byId('bench').hidden = false;
  resize();
  play();
  drawClips();
  drawViews();
  drawToggles();
  drawBudgets();
  aimCamera(camera, controls, VIEWS[state.view]);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    for (const figure of Object.values(figures)) figure.mixer.update(delta);
    controls.update();
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
