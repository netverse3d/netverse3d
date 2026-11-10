import { colorAt } from './shop-look.mjs';

const LEGEND_LIGHT = '#f4f2ff';
const LEGEND_DARK = '#1a1626';
const INK_THRESHOLD = 0.32;
const TOP_SHADE = 0.82;
const BACKGROUND = '#0b0a10';
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function keycapColor(recipe, layout, key) {
  const stops = recipe.palette?.keycap ?? ['#8a8a96'];
  return colorAt(stops, (key.x + key.w / 2) / layout.width).map((byte) =>
    Math.round(byte * TOP_SHADE),
  );
}

export function legendColor([r, g, b]) {
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
    ctx.fillStyle = `rgb(${rgb.join(', ')})`;
    ctx.fill();
    roundedRect(
      ctx,
      rect.x + inset * 2.2,
      rect.y + inset * 2.2,
      rect.w - 4.4 * inset,
      rect.h * 0.34,
      rect.h * 0.1,
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    const label = rect.key.label === 'Space' ? '' : rect.key.label;
    if (!label) continue;
    const ink = legendColor(rgb);
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink === LEGEND_DARK ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = Math.max(1, rect.h * 0.02);
    const cx = rect.x + rect.w / 2;
    if (rect.key.shift) {
      ctx.font = `600 ${fontSize(rect.key.shift, rect, 0.26)}px ${FONT}`;
      ctx.strokeText(rect.key.shift, cx, rect.y + rect.h * 0.32);
      ctx.fillText(rect.key.shift, cx, rect.y + rect.h * 0.32);
      ctx.font = `600 ${fontSize(label, rect, 0.34)}px ${FONT}`;
      ctx.strokeText(label, cx, rect.y + rect.h * 0.68);
      ctx.fillText(label, cx, rect.y + rect.h * 0.68);
    } else {
      const single = label.length === 1;
      ctx.font = `600 ${fontSize(label, rect, single ? 0.46 : 0.3)}px ${FONT}`;
      ctx.strokeText(label, cx, rect.y + rect.h * 0.53);
      ctx.fillText(label, cx, rect.y + rect.h * 0.53);
    }
  }
}

export function legendTexture(THREE, catalog, recipe, { createCanvas } = {}) {
  const canvas = (createCanvas ?? (() => globalThis.document.createElement('canvas')))();
  canvas.width = catalog.atlas.width;
  canvas.height = catalog.atlas.height;
  paintLegends(canvas.getContext('2d'), catalog, recipe);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
