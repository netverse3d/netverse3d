import { doorwayCell } from './shop-look.mjs';
import { buildShop } from './three-shop.mjs';

const CELL_SIZE = 2;
const INSIDE_MOUNT = 0.678;
const INSIDE_HEIGHT = 2.85;
const OUTSIDE_MOUNT = 1.002;
const OUTSIDE_HEIGHT = 2.95;
const BLADE_SIDE = 0.88;
const BLADE_HEIGHT = 2.5;
const CANVAS_SIZE = [1024, 256];
const TEXT_ANCHOR = [512, 136];
const FONT_FAMILY = '"Be Vietnam Pro", sans-serif';
const LARGEST_FONT = 176;
const GLYPH_WIDTH = 0.64;
const TEXT_WIDTH = 940;
const CONTRAST_ROWS = ['keycap', 'screen', 'accent'];
const DISTINCT_HUE = 40;
const TUBE_WIDTH = 12;
const CORE_WIDTH = 4;
const NEON_GLOW = 36;
const MATRIX_GLOW = 20;
const MATRIX_PITCH = 8;
const MATRIX_GAP = 2;
const MATRIX_PANEL = '#04060a';
const PAINT_SHADOW = 'rgba(0, 0, 0, 0.5)';
const PAINT_OFFSET = 6;
const PRECISION = 1e4;
const TOWARD_WALL = {
  south: { step: [0, 1], yaw: 0 },
  east: { step: [1, 0], yaw: Math.PI / 2 },
  north: { step: [0, -1], yaw: Math.PI },
  west: { step: [-1, 0], yaw: -Math.PI / 2 },
};

function snap(value) {
  return Math.round(value * PRECISION) / PRECISION;
}

function channels(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

function hexOf(rgb) {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function hue(hex) {
  const [red, green, blue] = channels(hex);
  const high = Math.max(red, green, blue);
  const spread = high - Math.min(red, green, blue);
  if (spread === 0) return 0;
  const sector =
    high === red
      ? ((green - blue) / spread + 6) % 6
      : high === green
        ? (blue - red) / spread + 2
        : (red - green) / spread + 4;
  return sector * 60;
}

function hueGap(first, second) {
  const gap = Math.abs(hue(first) - hue(second));
  return Math.min(gap, 360 - gap);
}

function mix(hex, other, amount) {
  const from = channels(hex);
  const to = channels(other);
  return hexOf(from.map((value, index) => value + (to[index] - value) * amount));
}

function opposite(hex) {
  const [red, green, blue] = channels(hex);
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  return hexOf([red, green, blue].map((value) => high + low - value));
}

export function contrastColor(recipe) {
  const frame = recipe.palette.strip?.[0] ?? '#ffffff';
  const candidates = CONTRAST_ROWS.flatMap((row) => recipe.palette[row] ?? []);
  const ranked = candidates
    .map((color) => ({ color, gap: hueGap(color, frame) }))
    .sort((first, second) => second.gap - first.gap);
  return ranked[0]?.gap >= DISTINCT_HUE ? ranked[0].color : opposite(frame);
}

export function signStyle(recipe) {
  const kind = recipe.sign.style ?? 'neon';
  const color = contrastColor(recipe);
  return {
    text: recipe.sign.text,
    kind,
    color: kind === 'painted' ? mix(color, '#ffffff', 0.7) : color,
    core: mix(color, '#ffffff', 0.75),
  };
}

function fontSize(text) {
  return Math.min(LARGEST_FONT, Math.floor(TEXT_WIDTH / (text.length * GLYPH_WIDTH)));
}

function fontFor(size) {
  return `800 ${size}px ${FONT_FAMILY}`;
}

function paintTube(context, style) {
  context.lineJoin = 'round';
  context.shadowColor = style.color;
  context.shadowBlur = NEON_GLOW;
  context.strokeStyle = style.color;
  context.lineWidth = TUBE_WIDTH;
  context.strokeText(style.text, ...TEXT_ANCHOR);
  context.strokeText(style.text, ...TEXT_ANCHOR);
  context.shadowBlur = 0;
  context.strokeStyle = style.core;
  context.lineWidth = CORE_WIDTH;
  context.strokeText(style.text, ...TEXT_ANCHOR);
}

function paintMatrix(context, style) {
  const [width, height] = CANVAS_SIZE;
  context.fillStyle = MATRIX_PANEL;
  context.fillRect(0, 0, width, height);
  context.shadowColor = style.color;
  context.shadowBlur = MATRIX_GLOW;
  context.fillStyle = style.color;
  context.fillText(style.text, ...TEXT_ANCHOR);
  context.shadowBlur = 0;
  context.fillStyle = style.core;
  context.fillText(style.text, ...TEXT_ANCHOR);
  context.fillStyle = MATRIX_PANEL;
  for (let x = 0; x < width; x += MATRIX_PITCH) context.fillRect(x, 0, MATRIX_GAP, height);
  for (let y = 0; y < height; y += MATRIX_PITCH) context.fillRect(0, y, width, MATRIX_GAP);
}

function paintBrush(context, style) {
  const [x, y] = TEXT_ANCHOR;
  context.shadowBlur = 0;
  context.fillStyle = PAINT_SHADOW;
  context.fillText(style.text, x + PAINT_OFFSET, y + PAINT_OFFSET);
  context.fillStyle = style.color;
  context.fillText(style.text, x, y);
}

const PAINTERS = { neon: paintTube, led: paintMatrix, painted: paintBrush };

export function paintSign(canvas, style) {
  const [width, height] = CANVAS_SIZE;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.font = fontFor(fontSize(style.text));
  const measured = context.measureText?.(style.text).width ?? 0;
  if (measured > TEXT_WIDTH) {
    context.font = fontFor(Math.floor((fontSize(style.text) * TEXT_WIDTH) / measured));
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  PAINTERS[style.kind](context, style);
  return canvas;
}

export function signPlan(recipe) {
  const { cells, door } = recipe.layout;
  const [width, depth] = cells;
  const [cellX, cellZ] = doorwayCell(door, cells);
  const { step, yaw } = TOWARD_WALL[door.wall];
  const side = [-step[1], step[0]];
  const centre = [(cellX - (width - 1) / 2) * CELL_SIZE, (cellZ - (depth - 1) / 2) * CELL_SIZE];
  const at = (out, along, height) => [
    snap(centre[0] + step[0] * out + side[0] * along),
    height,
    snap(centre[1] + step[1] * out + side[1] * along),
  ];
  const board = `sign_${recipe.variants.sign}`;
  return [
    { slot: 'sign', part: board, position: at(INSIDE_MOUNT, 0, INSIDE_HEIGHT), yaw },
    {
      slot: 'sign',
      part: board,
      position: at(OUTSIDE_MOUNT, 0, OUTSIDE_HEIGHT),
      yaw: yaw + Math.PI,
    },
    {
      slot: 'blade',
      part: `blade_${recipe.variants.blade}`,
      position: at(OUTSIDE_MOUNT, BLADE_SIDE, BLADE_HEIGHT),
      yaw: yaw + Math.PI,
    },
  ];
}

export function signTextMaterial(THREE, recipe, canvas) {
  const map = new THREE.CanvasTexture(paintSign(canvas, signStyle(recipe)));
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false });
  material.name = 'sign_text';
  return material;
}

export function buildSigns(THREE, kitScene, recipe, materials, canvas) {
  const text = signTextMaterial(THREE, recipe, canvas);
  const group = buildShop(THREE, kitScene, signPlan(recipe), { ...materials, decal: text });
  group.name = 'shop_signs';
  group.userData.text = text;
  return group;
}

export function repaintSigns(group, recipe) {
  const { map } = group.userData.text;
  paintSign(map.image, signStyle(recipe));
  map.needsUpdate = true;
}

export function disposeSigns(group) {
  group.userData.text.map.dispose();
  group.userData.text.dispose();
}
