const EXPRESSION_PREFIX = 'ex_';
const FIRST_ACTION = 'idle';
const DEFAULT_FACE = 'smile';
const CLIP_FACES = {
  run: 'excited',
  jump: 'excited',
  typing: 'focus',
  crouch: 'focus',
  drink: 'sip',
  shake: 'nervous',
  stretch: 'sleepy',
  cheer: 'laugh',
  touch: 'focus',
  carry: 'focus',
  look: 'confused',
  both_hands: 'excited',
  clap: 'laugh',
};
const HAND_PROPS = { drink: 'cup', carry: 'crate' };

export const HAND_PROP_NODES = Object.values(HAND_PROPS);

export function clipGroups(clips) {
  const actions = clips.filter((clip) => !clip.startsWith(EXPRESSION_PREFIX));
  return {
    actions: [
      ...actions.filter((clip) => clip === FIRST_ACTION),
      ...actions.filter((clip) => clip !== FIRST_ACTION),
    ],
    expressions: clips
      .filter((clip) => clip.startsWith(EXPRESSION_PREFIX))
      .map((clip) => clip.slice(EXPRESSION_PREFIX.length)),
  };
}

export function expressionClip(expression) {
  return `${EXPRESSION_PREFIX}${expression}`;
}

export function faceFor(clip) {
  if (clip.startsWith(EXPRESSION_PREFIX)) return clip.slice(EXPRESSION_PREFIX.length);
  return CLIP_FACES[clip] ?? DEFAULT_FACE;
}

export function handPropFor(clip) {
  return HAND_PROPS[clip] ?? null;
}

export function meshBudgets(config) {
  return Object.entries(config.character?.meshes ?? {}).map(([name, spec]) => ({
    name,
    maxTriangles: spec.maxTriangles,
    lodTriangles: spec.lodTriangles ?? null,
  }));
}
