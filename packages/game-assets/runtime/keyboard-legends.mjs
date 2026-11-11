import { COLORWAYS, keyboardOptions, zoneOf } from './keyboard-styles.mjs';
import { colorAt, hexToBytes } from './shop-look.mjs';

const LEGEND_LIGHT = '#f4f2ff';
const LEGEND_DARK = '#1a1626';
const INK_THRESHOLD = 0.32;
const TOP_SHADE = 0.82;
const BACKGROUND = '#0b0a10';
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

function hueBytes(hue) {
  const f = (n) => {
    const k = (n + hue / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

function cssOf([r, g, b], alpha = 1) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function keycapColor(recipe, layout, key) {
  const style = COLORWAYS[keyboardOptions(recipe).colorway];
  const zone = key.zone ?? zoneOf(key);
  const fixed = key.code === 'Space' && style.space ? style.space : style[zone];
  if (fixed) return hexToBytes(fixed);
  const stops = recipe.palette?.keycap ?? ['#8a8a96'];
  return colorAt(stops, (key.x + key.w / 2) / layout.width).map((byte) =>
    Math.round(byte * TOP_SHADE),
  );
}

export function ledColor(recipe, layout, key) {
  const { led } = keyboardOptions(recipe);
  if (led === 'off') return null;
  if (led === 'white') return [255, 255, 255];
  if (led === 'single') return colorAt(recipe.palette?.strip ?? ['#ffffff'], 0.5);
  return hueBytes((360 * (key.x + key.w / 2)) / layout.width);
}

export function legendColor([r, g, b], recipe = null) {
  const style = recipe ? COLORWAYS[keyboardOptions(recipe).colorway] : null;
  if (style?.legend) return style.legend;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > INK_THRESHOLD ? LEGEND_DARK : LEGEND_LIGHT;
}

export function keyRects(catalog) {
  const { width } = catalog.atlas;
  const rects = [];
  for (const layout of catalog.layouts) {
    const strip = catalog.atlas.strips.find((entry) => entry.id === layout.id);
    const px = width / layout.width;
    const py = strip.height / layout.depth;
    for (const key of layout.keys) {
      rects.push({
        layout,
        key,
        x: key.x * px,
        y: strip.y + key.y * py,
        w: key.w * px,
        h: key.h * py,
      });
    }
  }
  return rects;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fontSize(label, rect, scale) {
  const byHeight = rect.h * scale;
  const byWidth = (rect.w * 0.82) / (label.length * 0.6);
  return Math.min(byHeight, byWidth);
}

function drawLegend(ctx, rect, ink, outline) {
  const label = rect.key.label === 'Space' ? '' : rect.key.label;
  if (!label) return;
  ctx.fillStyle = ink;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, rect.h * 0.02);
  const cx = rect.x + rect.w / 2;
  const lines = rect.key.shift
    ? [
        [rect.key.shift, 0.26, 0.32],
        [label, 0.34, 0.68],
      ]
    : [[label, label.length === 1 ? 0.46 : 0.3, 0.53]];
  for (const [text, scale, at] of lines) {
    ctx.font = `600 ${fontSize(text, rect, scale)}px ${FONT}`;
    if (outline) ctx.strokeText(text, cx, rect.y + rect.h * at);
    ctx.fillText(text, cx, rect.y + rect.h * at);
  }
}

function sideColumn(catalog, rect) {
  const column = catalog.atlas.sideColumn;
  return {
    x: rect.x + rect.w * column.x0,
    y: rect.y + rect.h * column.y0,
    w: rect.w * (column.x1 - column.x0),
    h: rect.h * (column.y1 - column.y0),
  };
}

export function paintLegends(ctx, catalog, recipe) {
  const { width, height } = catalog.atlas;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const rect of keyRects(catalog)) {
    const rgb = keycapColor(recipe, rect.layout, rect.key);
    const inset = rect.h * 0.05;
    roundedRect(
      ctx,
      rect.x + inset,
      rect.y + inset,
      rect.w - 2 * inset,
      rect.h - 2 * inset,
      rect.h * 0.12,
    );
    ctx.fillStyle = cssOf(rgb);
    ctx.fill();
    roundedRect(
      ctx,
      rect.x + inset * 2.4,
      rect.y + inset * 2.4,
      rect.w - 4.8 * inset,
      rect.h * 0.16,
      rect.h * 0.08,
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    const ink = legendColor(rgb, recipe);
    const dark = ink === LEGEND_DARK || hexToBytes(ink).reduce((sum, byte) => sum + byte, 0) < 384;
    drawLegend(ctx, rect, ink, dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)');
  }
}

export function paintEmissive(ctx, catalog, recipe) {
  const { width, height } = catalog.atlas;
  const style = COLORWAYS[keyboardOptions(recipe).colorway];
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const rect of keyRects(catalog)) {
    const led = ledColor(recipe, rect.layout, rect.key);
    if (!led) continue;
    const inset = rect.h * 0.05;
    roundedRect(
      ctx,
      rect.x + inset * 0.4,
      rect.y + inset * 0.4,
      rect.w - 0.8 * inset,
      rect.h - 0.8 * inset,
      rect.h * 0.14,
    );
    ctx.lineWidth = inset * 1.2;
    ctx.strokeStyle = cssOf(led, style.pudding ? 0.9 : 0.35);
    ctx.stroke();
    const column = sideColumn(catalog, rect);
    const glow = ctx.createLinearGradient(0, column.y, 0, column.y + column.h);
    glow.addColorStop(0, cssOf(led, style.pudding ? 0.25 : 0.0));
    glow.addColorStop(1, cssOf(led, style.pudding ? 1 : 0.3));
    ctx.fillStyle = glow;
    ctx.fillRect(column.x, column.y, column.w, column.h);
    drawLegend(ctx, rect, cssOf(led), null);
  }
}

function paintedTexture(THREE, canvas, paint, catalog, recipe) {
  canvas.width = catalog.atlas.width;
  canvas.height = catalog.atlas.height;
  paint(canvas.getContext('2d'), catalog, recipe);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function legendTextures(THREE, catalog, recipe, { createCanvas } = {}) {
  const newCanvas = createCanvas ?? (() => globalThis.document.createElement('canvas'));
  return {
    map: paintedTexture(THREE, newCanvas(), paintLegends, catalog, recipe),
    emissive: paintedTexture(THREE, newCanvas(), paintEmissive, catalog, recipe),
  };
}

export function legendTexture(THREE, catalog, recipe, options = {}) {
  return legendTextures(THREE, catalog, recipe, options).map;
}
