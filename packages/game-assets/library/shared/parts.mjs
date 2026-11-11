import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { legendTextures } from '../../runtime/keyboard-legends.mjs';
import { COLORWAYS, LED_MODES, keyboardOptions } from '../../runtime/keyboard-styles.mjs';
import { paletteRows } from '../../runtime/shop-look.mjs';
import { kitLightmap, previewKitFiles, shopMaterials } from '../../runtime/three-shop.mjs';
import { pageHref, sectionTabs } from './catalog.mjs';
import {
  budgetUse,
  filterParts,
  partCount,
  partGroups,
  shopsUsing,
  withKeyboard,
} from './parts-data.mjs';
import { element, loadShell, mountNav, readJson, stateBadge } from './shell.mjs';

const SECTION_ID = 'parts';
const INSPECT_FILE = 'lab.html';
const PACKAGE_ROOT = new URL('../../', import.meta.url);
const UP = new THREE.Vector3(0, 1, 0);
const VIEW_BACKGROUND = new THREE.Color('#1a1533');
const PAGE_BACKGROUND = new THREE.Color('#0d0a18');
const SPIN_SPEED = 0.35;
const byId = (id) => document.getElementById(id);
const count = (value) => value.toLocaleString('vi-VN');

function triangleCount(object) {
  let total = 0;
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    total += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  });
  return Math.round(total);
}

function studioLights(scene, environment) {
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

function partStage(source, environment) {
  const group = new THREE.Group();
  const model = source.clone(true);
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.userData.row = mesh.material.name;
    mesh.frustumCulled = false;
  });
  group.add(model);
  const scene = new THREE.Scene();
  studioLights(scene, environment);
  scene.add(group);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const pivot = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 1.25 + 0.05;
  const camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.05, 60);
  camera.position
    .set(0.8, 0.6, -1)
    .normalize()
    .multiplyScalar(radius * 1.55)
    .add(pivot);
  camera.lookAt(pivot);
  return { scene, camera, group, pivot, triangles: triangleCount(model) };
}

function fillSelect(select, options, value) {
  select.replaceChildren(...options.map(([id, label]) => element('option', { value: id }, label)));
  select.value = value;
}

function drawHead(shell, section) {
  const { text } = shell;
  mountNav(byId('nav'), shell, SECTION_ID);
  byId('page-title').textContent = section.title;
  byId('page-badge').replaceChildren(stateBadge(section.state, text));
  byId('page-summary').textContent = section.summary;
  byId('page-tabs').replaceChildren(
    ...sectionTabs(section, 'main', text.mainPage).map((tab) =>
      element(
        'a',
        { class: 'stage-tab', href: tab.href, 'aria-current': tab.current ? 'page' : null },
        tab.title,
      ),
    ),
  );
  document.title = `${section.title} · ${text.brand}`;
}

function inspectHref(section, name) {
  const page = section.pages.findIndex((item) => item.src.startsWith(INSPECT_FILE));
  return `${pageHref(section, Math.max(page, 0))}&part=${name}&spin=0`;
}

function budgetRow(triangles, maxTriangles, words) {
  const use = budgetUse(triangles, maxTriangles);
  const fill = element('i', {});
  fill.style.width = `${Math.round(use.ratio * 100)}%`;
  return element(
    'div',
    { class: 'budget', 'data-level': use.level, title: words.levels[use.level] },
    [
      element('span', { class: 'budget-bar' }, fill),
      element(
        'span',
        { class: 'budget-text' },
        `${count(triangles)} / ${count(maxTriangles)} ${words.triangles}`,
      ),
    ],
  );
}

async function main() {
  const shell = await loadShell();
  const section = shell.sections.find((item) => item.id === SECTION_ID);
  const words = shell.text.parts;
  drawHead(shell, section);

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

  const [config, recipeIds, keyboards] = await Promise.all([
    readJson(new URL('assets.config.json', PACKAGE_ROOT)),
    readJson(new URL('recipes/index.json', PACKAGE_ROOT)),
    readJson(new URL('keyboards.json', PACKAGE_ROOT)),
  ]);
  const recipes = Object.fromEntries(
    await Promise.all(
      recipeIds.map(async (id) => [
        id,
        await readJson(new URL(`recipes/${id}.json`, PACKAGE_ROOT)),
      ]),
    ),
  );
  const groups = partGroups(config);
  const loader = new GLTFLoader();
  const kits = Object.fromEntries(
    await Promise.all(
      groups.map(async (group) => [
        group.kit,
        await loader.loadAsync(new URL(`exported/${group.kit}`, PACKAGE_ROOT).href),
      ]),
    ),
  );
  const rows = paletteRows(config.palette);
  const environment = new THREE.PMREMGenerator(renderer).fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;

  const query = new URLSearchParams(window.location.search);
  const state = {
    recipeId: recipeIds.includes(query.get('recipe')) ? query.get('recipe') : recipeIds[0],
    keyboard: {},
    kit: groups.some((group) => group.kit === query.get('kit')) ? query.get('kit') : null,
    query: query.get('q') ?? '',
    spin: query.get('spin') !== '0',
    occlusion: true,
  };
  let stale = true;

  const cards = [];
  const groupNodes = [];
  const catalog = byId('catalog');
  for (const group of groups) {
    const slotNodes = [];
    for (const slot of group.slots) {
      const grid = element('div', { class: 'part-grid' });
      for (const part of slot.parts) {
        const source = kits[group.kit].scene.getObjectByName(part.name);
        if (!source) continue;
        const stage = partStage(source, environment);
        const shops = shopsUsing(recipes, recipeIds, part.slot, part.variant);
        const view = element('div', { class: 'part-view' });
        const node = element('article', { class: 'part', 'data-part': part.name }, [
          view,
          element('div', { class: 'part-meta' }, [
            element('div', { class: 'part-name' }, [
              element('b', {}, part.name),
              element('span', {}, words.slots[part.slot] ?? part.slot),
            ]),
            budgetRow(stage.triangles, slot.maxTriangles, words),
            element(
              'p',
              { class: 'part-used', 'data-used': String(shops.length > 0) },
              shops.length > 0 ? `${words.usedBy} ${shops.join(', ')}` : words.unused,
            ),
            element(
              'a',
              { class: 'button', 'data-kind': 'quiet', href: inspectHref(section, part.name) },
              words.inspect,
            ),
          ]),
        ]);
        cards.push({ ...part, ...stage, node, view });
        grid.append(node);
      }
      const node = element('section', { class: 'part-slot' }, [
        element('h3', {}, [
          words.slots[slot.slot] ?? slot.slot,
          element(
            'small',
            {},
            `${slot.parts.length} ${words.variants} · ${words.budget} ${count(slot.maxTriangles)} ${words.triangles} · ${words.frame} ${slot.size.join(' × ')} m`,
          ),
        ]),
        grid,
      ]);
      slotNodes.push({ slot: slot.slot, node });
    }
    const node = element('section', { class: 'part-kit' }, [
      element('h2', {}, words.kits[group.kit] ?? group.kit),
      ...slotNodes.map((item) => item.node),
    ]);
    groupNodes.push({ kit: group.kit, node, slots: slotNodes });
    catalog.append(node);
  }

  let materialSets = {};
  function paint() {
    for (const set of Object.values(materialSets)) {
      for (const material of Object.values(set)) {
        material.map?.dispose();
        material.emissiveMap?.dispose();
        material.dispose();
      }
    }
    const recipe = withKeyboard(recipes[state.recipeId], state.keyboard);
    const legends = legendTextures(THREE, keyboards, recipe);
    materialSets = Object.fromEntries(
      Object.entries(kits).map(([file, gltf]) => [
        file,
        shopMaterials(THREE, recipe, rows, {
          glowBoost: 1.1,
          lightmap: kitLightmap(gltf.scene),
          lightmapIntensity: state.occlusion ? 1 : 0,
          legends,
        }),
      ]),
    );
    const chosen = recipes[state.recipeId].variants;
    for (const card of cards) {
      const set = materialSets[card.kit];
      card.group.traverse((mesh) => {
        if (mesh.isMesh) mesh.material = set[mesh.userData.row] ?? set.surface;
      });
      card.node.dataset.chosen = String(chosen[card.slot] === card.variant);
    }
    stale = true;
  }

  function filter() {
    const found = filterParts(groups, state, words.slots);
    const shown = new Set(
      found.flatMap((group) => group.slots.flatMap((slot) => slot.parts.map((part) => part.name))),
    );
    for (const card of cards) card.node.hidden = !shown.has(card.name);
    for (const group of groupNodes) {
      const match = found.find((item) => item.kit === group.kit);
      group.node.hidden = !match;
      for (const slot of group.slots) {
        slot.node.hidden = !match?.slots.some((item) => item.slot === slot.slot);
      }
    }
    const total = partCount(groups);
    byId('count').textContent =
      shown.size === total
        ? `${count(total)} ${words.count}`
        : `${count(shown.size)} ${words.of} ${count(total)} ${words.count}`;
    byId('empty').hidden = shown.size > 0;
    stale = true;
  }

  function remember() {
    const params = new URLSearchParams();
    params.set('recipe', state.recipeId);
    if (state.kit) params.set('kit', state.kit);
    if (state.query.trim()) params.set('q', state.query.trim());
    if (!state.spin) params.set('spin', '0');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }

  const recipeSelect = byId('recipe');
  const colorwaySelect = byId('colorway');
  const ledSelect = byId('led');
  fillSelect(
    recipeSelect,
    recipeIds.map((id) => [id, recipes[id].name]),
    state.recipeId,
  );
  function showKeyboard() {
    const options = keyboardOptions(withKeyboard(recipes[state.recipeId], state.keyboard));
    fillSelect(
      colorwaySelect,
      Object.entries(COLORWAYS).map(([id, colorway]) => [id, colorway.name]),
      options.colorway,
    );
    fillSelect(ledSelect, Object.entries(LED_MODES), options.led);
  }
  recipeSelect.addEventListener('change', () => {
    state.recipeId = recipeSelect.value;
    state.keyboard = {};
    showKeyboard();
    paint();
    remember();
  });
  colorwaySelect.addEventListener('change', () => {
    state.keyboard = { ...state.keyboard, colorway: colorwaySelect.value };
    paint();
  });
  ledSelect.addEventListener('change', () => {
    state.keyboard = { ...state.keyboard, led: ledSelect.value };
    paint();
  });

  const kitChips = byId('kits');
  function drawKitChips() {
    kitChips.replaceChildren(
      ...[
        [null, words.all],
        ...groups.map((group) => [group.kit, words.kits[group.kit] ?? group.kit]),
      ].map(([kit, label]) => {
        const chip = element(
          'button',
          { class: 'chip', type: 'button', 'aria-pressed': String(state.kit === kit) },
          label,
        );
        chip.addEventListener('click', () => {
          state.kit = kit;
          drawKitChips();
          filter();
          remember();
        });
        return chip;
      }),
    );
  }

  const search = byId('search');
  search.value = state.query;
  search.addEventListener('input', () => {
    state.query = search.value;
    filter();
    remember();
  });

  const spinButton = byId('spin');
  spinButton.setAttribute('aria-pressed', String(state.spin));
  spinButton.addEventListener('click', () => {
    state.spin = !state.spin;
    spinButton.setAttribute('aria-pressed', String(state.spin));
    remember();
  });
  const occlusionButton = byId('occlusion');
  const previewKits = previewKitFiles(kits);
  if (previewKits.length > 0) {
    occlusionButton.disabled = true;
    occlusionButton.setAttribute('aria-pressed', 'false');
    occlusionButton.textContent = words.previewOcclusion;
    occlusionButton.title = `${words.previewTitle}${previewKits.join(', ')}`;
  }
  occlusionButton.addEventListener('click', () => {
    state.occlusion = !state.occlusion;
    occlusionButton.setAttribute('aria-pressed', String(state.occlusion));
    paint();
  });

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    stale = true;
  }
  window.addEventListener('resize', resize);
  window.addEventListener(
    'scroll',
    () => {
      stale = true;
    },
    { capture: true, passive: true },
  );

  showKeyboard();
  drawKitChips();
  resize();
  paint();
  filter();
  byId('status').hidden = true;
  byId('tools').hidden = false;

  const swing = new THREE.Vector3();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (!stale && !state.spin) return;
    stale = false;
    const height = renderer.domElement.clientHeight;
    renderer.setScissorTest(false);
    renderer.setClearColor(PAGE_BACKGROUND);
    renderer.clear();
    renderer.setScissorTest(true);
    renderer.setClearColor(VIEW_BACKGROUND);
    for (const card of cards) {
      if (card.node.hidden) continue;
      if (state.spin) {
        card.group.rotation.y += delta * SPIN_SPEED;
        swing.copy(card.pivot).applyAxisAngle(UP, card.group.rotation.y);
        card.group.position.copy(card.pivot).sub(swing);
      }
      const rect = card.view.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > height || rect.width === 0) continue;
      const bottom = height - rect.bottom;
      renderer.setViewport(rect.left, bottom, rect.width, rect.height);
      renderer.setScissor(rect.left, bottom, rect.width, rect.height);
      renderer.clear();
      card.camera.aspect = rect.width / rect.height;
      card.camera.updateProjectionMatrix();
      renderer.render(card.scene, card.camera);
    }
  });
  document.body.dataset.ready = 'true';
}

main().catch((reason) => {
  console.error(reason);
  document.body.dataset.ready = 'failed';
  byId('status').hidden = true;
  byId('problem').hidden = false;
});
