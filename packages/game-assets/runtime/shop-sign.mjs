import { doorwayCell } from './shop-look.mjs';

const CELL_SIZE = 2;
const SIGN_HEIGHT = 2.62;
const SIGN_INSET = 0.5;
const SIGN_SIZE = [1.6, 0.4];
const CANVAS_SIZE = [512, 128];
const TEXT_ANCHOR = [256, 68];
const SIGN_FONT = '700 64px "Be Vietnam Pro", sans-serif';
const PAINTED_BACKGROUND = '#1a1320';
const LIT_BACKGROUND = 'rgba(11, 8, 20, 0.85)';
const GLOW_BLUR = 26;
const PRECISION = 1e4;
const INWARD = {
  south: { step: [0, 1], yaw: 0 },
  east: { step: [1, 0], yaw: Math.PI / 2 },
  north: { step: [0, -1], yaw: Math.PI },
  west: { step: [-1, 0], yaw: -Math.PI / 2 },
};

function snap(value) {
  return Math.round(value * PRECISION) / PRECISION;
}

export function signPlacement(recipe) {
  const { cells, door } = recipe.layout;
  const [width, depth] = cells;
  const [cellX, cellZ] = doorwayCell(door, cells);
  const { step, yaw } = INWARD[door.wall];
  return {
    position: [
      snap((cellX - (width - 1) / 2) * CELL_SIZE + step[0] * SIGN_INSET),
      SIGN_HEIGHT,
      snap((cellZ - (depth - 1) / 2) * CELL_SIZE + step[1] * SIGN_INSET),
    ],
    yaw: yaw + Math.PI,
    size: SIGN_SIZE,
  };
}

export function signStyle(recipe) {
  const style = recipe.sign.style ?? 'neon';
  const painted = style === 'painted';
  return {
    text: recipe.sign.text,
    color: recipe.palette.accent?.[0] ?? '#ffffff',
    background: painted ? PAINTED_BACKGROUND : LIT_BACKGROUND,
    glow: painted ? 0 : GLOW_BLUR,
    passes: style === 'led' ? 3 : 2,
  };
}

export function paintSign(canvas, style) {
  const [width, height] = CANVAS_SIZE;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.fillStyle = style.background;
  context.fillRect(0, 0, width, height);
  context.font = SIGN_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = style.color;
  context.shadowColor = style.color;
  context.shadowBlur = style.glow;
  for (let pass = 0; pass < style.passes; pass += 1) {
    context.fillText(style.text, ...TEXT_ANCHOR);
  }
  return canvas;
}

export function buildSign(THREE, recipe, canvas) {
  const { position, yaw, size } = signPlacement(recipe);
  const map = new THREE.CanvasTexture(paintSign(canvas, signStyle(recipe)));
  map.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(...size),
    new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }),
  );
  sign.name = 'shop_sign';
  sign.position.set(...position);
  sign.rotation.y = yaw;
  return sign;
}

export function repaintSign(sign, recipe) {
  paintSign(sign.material.map.image, signStyle(recipe));
  sign.material.map.needsUpdate = true;
}
