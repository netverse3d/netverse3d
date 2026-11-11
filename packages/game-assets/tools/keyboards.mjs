import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KEY_UNIT = 0.01905;
export const ATLAS_WIDTH = 2048;

const SHIFTED = {
  '`': '~',
  1: '!',
  2: '@',
  3: '#',
  4: '$',
  5: '%',
  6: '^',
  7: '&',
  8: '*',
  9: '(',
  0: ')',
  '-': '_',
  '=': '+',
  '[': '{',
  ']': '}',
  '\\': '|',
  ';': ':',
  "'": '"',
  ',': '<',
  '.': '>',
  '/': '?',
};

const CODES = {
  '`': 'Backquote',
  '-': 'Minus',
  '=': 'Equal',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  Esc: 'Escape',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Caps: 'CapsLock',
  Enter: 'Enter',
  Space: 'Space',
  Fn: 'Fn',
  Menu: 'ContextMenu',
  Del: 'Delete',
  Ins: 'Insert',
  Home: 'Home',
  End: 'End',
  PgUp: 'PageUp',
  PgDn: 'PageDown',
  PrtSc: 'PrintScreen',
  ScrLk: 'ScrollLock',
  Pause: 'Pause',
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
  '←': 'ArrowLeft',
  '→': 'ArrowRight',
};

function codeOf(label) {
  if (CODES[label]) return CODES[label];
  if (/^[A-Z]$/.test(label)) return `Key${label}`;
  if (/^[0-9]$/.test(label)) return `Digit${label}`;
  return label;
}

function row(y, items, x = 0) {
  const keys = [];
  for (const item of items) {
    if (typeof item === 'number') {
      x += item;
      continue;
    }
    const [label, w = 1, code] = Array.isArray(item) ? item : [item];
    keys.push({ code: code ?? codeOf(label), label, shift: SHIFTED[label] ?? null, x, y, w, h: 1 });
    x += w;
  }
  return keys;
}

const NUMBERS = ['`', ...'1234567890', '-', '='];
const TOP = [...'QWERTYUIOP', '[', ']'];
const HOME = [...'ASDFGHJKL', ';', "'"];
const BOTTOM = [...'ZXCVBNM', ',', '.', '/'];
const F_KEYS = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);
const MODIFIERS_LEFT = [
  ['Ctrl', 1.25, 'ControlLeft'],
  ['Win', 1.25, 'MetaLeft'],
  ['Alt', 1.25, 'AltLeft'],
];

function mainRows(y0, bottomRow, rightShift = 2.75) {
  return [
    ...row(y0, [...NUMBERS, ['Backspace', 2]]),
    ...row(y0 + 1, [['Tab', 1.5], ...TOP, ['\\', 1.5]]),
    ...row(y0 + 2, [['Caps', 1.75], ...HOME, ['Enter', 2.25]]),
    ...row(y0 + 3, [['Shift', 2.25, 'ShiftLeft'], ...BOTTOM, ['Shift', rightShift, 'ShiftRight']]),
    ...row(y0 + 4, bottomRow),
  ];
}

const COMPACT_BOTTOM = [
  ...MODIFIERS_LEFT,
  ['Space', 6.25],
  ['Alt', 1.25, 'AltRight'],
  ['Fn', 1.25],
  ['Menu', 1.25],
  ['Ctrl', 1.25, 'ControlRight'],
];

function ansi60() {
  return {
    id: 'ansi-60',
    variant: 'a',
    name: '60% ANSI',
    width: 15,
    depth: 5,
    keys: mainRows(0, COMPACT_BOTTOM),
  };
}

function ansiTkl() {
  const fRow = row(0, [
    'Esc',
    1,
    ...F_KEYS.slice(0, 4),
    0.5,
    ...F_KEYS.slice(4, 8),
    0.5,
    ...F_KEYS.slice(8, 12),
    0.25,
    'PrtSc',
    'ScrLk',
    'Pause',
  ]);
  const nav = [
    ...row(1.5, ['Ins', 'Home', 'PgUp'], 15.25),
    ...row(2.5, ['Del', 'End', 'PgDn'], 15.25),
    ...row(4.5, ['↑'], 16.25),
    ...row(5.5, ['←', '↓', '→'], 15.25),
  ];
  return {
    id: 'ansi-tkl',
    variant: 'b',
    name: 'Tenkeyless ANSI',
    width: 18.25,
    depth: 6.5,
    keys: [...fRow, ...mainRows(1.5, COMPACT_BOTTOM), ...nav],
  };
}

function ansi75() {
  const fRow = row(0, [
    'Esc',
    0.5,
    ...F_KEYS.slice(0, 4),
    0.5,
    ...F_KEYS.slice(4, 8),
    0.5,
    ...F_KEYS.slice(8, 12),
    0.5,
    'Del',
  ]);
  const bottom = [
    ...MODIFIERS_LEFT,
    ['Space', 6.25],
    ['Alt', 1, 'AltRight'],
    ['Fn', 1],
    ['Ctrl', 1, 'ControlRight'],
    '←',
    '↓',
    '→',
  ];
  const column = [
    ...row(1.25, ['Home'], 15),
    ...row(2.25, ['PgUp'], 15),
    ...row(3.25, ['PgDn'], 15),
    ...row(4.25, ['↑', 'End'], 14),
  ];
  return {
    id: 'ansi-75',
    variant: 'c',
    name: '75% ANSI',
    width: 16,
    depth: 6.25,
    keys: [...fRow, ...mainRows(1.25, bottom, 1.75), ...column],
  };
}

export function keyboardLayouts() {
  return [ansi60(), ansiTkl(), ansi75()];
}

export function layoutProblems(layout) {
  const problems = [];
  const codes = new Set();
  const keys = layout.keys;
  for (const key of keys) {
    if (
      key.x < 0 ||
      key.y < 0 ||
      key.x + key.w > layout.width + 1e-9 ||
      key.y + key.h > layout.depth + 1e-9
    ) {
      problems.push(`${layout.id}: ${key.code} leaves the board`);
    }
    if (codes.has(key.code)) problems.push(`${layout.id}: ${key.code} appears twice`);
    codes.add(key.code);
  }
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const a = keys[i];
      const b = keys[j];
      const apart =
        a.x + a.w <= b.x + 1e-9 ||
        b.x + b.w <= a.x + 1e-9 ||
        a.y + a.h <= b.y + 1e-9 ||
        b.y + b.h <= a.y + 1e-9;
      if (!apart) problems.push(`${layout.id}: ${a.code} overlaps ${b.code}`);
    }
  }
  return problems;
}

export function atlasOf(layouts, width = ATLAS_WIDTH) {
  let y = 0;
  const strips = layouts.map((layout) => {
    const height = Math.round((width * layout.depth) / layout.width);
    const strip = { id: layout.id, y, height };
    y += height;
    return strip;
  });
  return { width, height: y, strips };
}

export function keyboardCatalog() {
  const layouts = keyboardLayouts();
  return { unit: KEY_UNIT, layouts, atlas: atlasOf(layouts) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const out = join(root, 'keyboards.json');
  writeFileSync(out, JSON.stringify(keyboardCatalog(), null, 2) + '\n');
  console.log(`wrote ${out}`);
}
