import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zoneOf } from '../runtime/keyboard-styles.mjs';

export const KEY_UNIT = 0.01905;
export const ATLAS_WIDTH = 2048;
export const SIDE_COLUMN = { x0: 0.08, x1: 0.11, y0: 0.32, y1: 0.68 };

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
  Num: 'NumLock',
};

function codeOf(label) {
  if (CODES[label]) return CODES[label];
  if (/^[A-Z]$/.test(label)) return `Key${label}`;
  if (/^[0-9]$/.test(label)) return `Digit${label}`;
  return label;
}

function keyRow(y, items, x = 0) {
  const keys = [];
  for (const item of items) {
    if (typeof item === 'number') {
      x += item;
      continue;
    }
    const [label, w = 1, code, h = 1] = Array.isArray(item) ? item : [item];
    const key = { code: code ?? codeOf(label), label, shift: SHIFTED[label] ?? null, x, y, w, h };
    key.zone = zoneOf(key);
    keys.push(key);
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
    ...keyRow(y0, [...NUMBERS, ['Backspace', 2]]),
    ...keyRow(y0 + 1, [['Tab', 1.5], ...TOP, ['\\', 1.5]]),
    ...keyRow(y0 + 2, [['Caps', 1.75], ...HOME, ['Enter', 2.25]]),
    ...keyRow(y0 + 3, [
      ['Shift', 2.25, 'ShiftLeft'],
      ...BOTTOM,
      ['Shift', rightShift, 'ShiftRight'],
    ]),
    ...keyRow(y0 + 4, bottomRow),
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

const ARROW_BOTTOM = [
  ...MODIFIERS_LEFT,
  ['Space', 6.25],
  ['Alt', 1, 'AltRight'],
  ['Fn', 1],
  ['Ctrl', 1, 'ControlRight'],
  '←',
  '↓',
  '→',
];

function fRow(gaps, tail) {
  return keyRow(0, [
    'Esc',
    gaps[0],
    ...F_KEYS.slice(0, 4),
    gaps[1],
    ...F_KEYS.slice(4, 8),
    gaps[1],
    ...F_KEYS.slice(8, 12),
    gaps[2],
    ...tail,
  ]);
}

function navCluster(y0, x0) {
  return [
    ...keyRow(y0, ['Ins', 'Home', 'PgUp'], x0),
    ...keyRow(y0 + 1, ['Del', 'End', 'PgDn'], x0),
    ...keyRow(y0 + 3, ['↑'], x0 + 1),
    ...keyRow(y0 + 4, ['←', '↓', '→'], x0),
  ];
}

function numpad(y0, x0) {
  return [
    ...keyRow(
      y0,
      ['Num', ['/', 1, 'NumpadDivide'], ['*', 1, 'NumpadMultiply'], ['-', 1, 'NumpadSubtract']],
      x0,
    ),
    ...keyRow(
      y0 + 1,
      [
        ['7', 1, 'Numpad7'],
        ['8', 1, 'Numpad8'],
        ['9', 1, 'Numpad9'],
        ['+', 1, 'NumpadAdd', 2],
      ],
      x0,
    ),
    ...keyRow(
      y0 + 2,
      [
        ['4', 1, 'Numpad4'],
        ['5', 1, 'Numpad5'],
        ['6', 1, 'Numpad6'],
      ],
      x0,
    ),
    ...keyRow(
      y0 + 3,
      [
        ['1', 1, 'Numpad1'],
        ['2', 1, 'Numpad2'],
        ['3', 1, 'Numpad3'],
        ['Enter', 1, 'NumpadEnter', 2],
      ],
      x0,
    ),
    ...keyRow(
      y0 + 4,
      [
        ['0', 2, 'Numpad0'],
        ['.', 1, 'NumpadDecimal'],
      ],
      x0,
    ),
  ].map((key) =>
    key.code.startsWith('Numpad') || key.code === 'NumLock' ? { ...key, shift: null } : key,
  );
}

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
  return {
    id: 'ansi-tkl',
    variant: 'b',
    name: 'Tenkeyless ANSI',
    width: 18.25,
    depth: 6.5,
    keys: [
      ...fRow([1, 0.5, 0.25], ['PrtSc', 'ScrLk', 'Pause']),
      ...mainRows(1.5, COMPACT_BOTTOM),
      ...navCluster(1.5, 15.25),
    ],
  };
}

function ansi75() {
  const column = [
    ...keyRow(1.25, ['Home'], 15),
    ...keyRow(2.25, ['PgUp'], 15),
    ...keyRow(3.25, ['PgDn'], 15),
    ...keyRow(4.25, ['↑', 'End'], 14),
  ];
  return {
    id: 'ansi-75',
    variant: 'c',
    name: '75% ANSI',
    width: 16,
    depth: 6.25,
    keys: [...fRow([0.5, 0.5, 0.5], ['Del']), ...mainRows(1.25, ARROW_BOTTOM, 1.75), ...column],
  };
}

function ansi65() {
  const column = [
    ...keyRow(0, ['Del'], 15),
    ...keyRow(1, ['PgUp'], 15),
    ...keyRow(2, ['PgDn'], 15),
    ...keyRow(3, ['↑', 'End'], 14),
  ];
  return {
    id: 'ansi-65',
    variant: 'd',
    name: '65% ANSI',
    width: 16,
    depth: 5,
    keys: [...mainRows(0, ARROW_BOTTOM, 1.75), ...column],
  };
}

function ansi100() {
  return {
    id: 'ansi-100',
    variant: 'e',
    name: 'Full-size ANSI',
    width: 22.5,
    depth: 6.5,
    keys: [
      ...fRow([1, 0.5, 0.25], ['PrtSc', 'ScrLk', 'Pause']),
      ...mainRows(1.5, COMPACT_BOTTOM),
      ...navCluster(1.5, 15.25),
      ...numpad(1.5, 18.5),
    ],
  };
}

export function keyboardLayouts() {
  return [ansi60(), ansiTkl(), ansi75(), ansi65(), ansi100()];
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
  return { width, height: y, strips, sideColumn: SIDE_COLUMN };
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
