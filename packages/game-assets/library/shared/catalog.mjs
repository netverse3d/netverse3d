export const SECTION_STATES = ['rebuilt', 'legacy', 'planned'];

const OVERVIEW_ID = 'overview';
const EXPRESSION_PREFIX = 'ex_';
const STATION_KIT = 'station-parts.glb';
const ROOM_KIT = 'room-kit.glb';
const FIGURES = {
  characters: (summary) => ({ value: summary.actions, unit: 'actions' }),
  parts: (summary) => ({ value: summary.stationVariants, unit: 'variants' }),
  rooms: (summary) => ({ value: summary.roomVariants, unit: 'modules' }),
  shops: (summary) => ({ value: summary.shops, unit: 'shops' }),
};

function variantsOf(kit) {
  return Object.values(kit?.slots ?? {}).reduce(
    (total, slot) => total + (slot.variants?.length ?? 0),
    0,
  );
}

export function catalogSummary(config, recipeIds) {
  const kits = config.kits ?? [];
  const clips = config.clips ?? [];
  const expressions = clips.filter((clip) => clip.startsWith(EXPRESSION_PREFIX)).length;
  const kitNamed = (file) => kits.find((kit) => kit.file === file);
  return {
    slots: kits.reduce((total, kit) => total + Object.keys(kit.slots ?? {}).length, 0),
    variants: kits.reduce((total, kit) => total + variantsOf(kit), 0),
    stationVariants: variantsOf(kitNamed(STATION_KIT)),
    roomVariants: variantsOf(kitNamed(ROOM_KIT)),
    actions: clips.length - expressions,
    expressions,
    shops: recipeIds.length,
    scenes: (config.scenes ?? []).length,
  };
}

export function navItems(sections, currentId) {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    href: section.state === 'planned' ? null : section.href,
    state: section.state,
    current: section.id === currentId,
  }));
}

export function sectionCards(sections, summary) {
  return sections
    .filter((section) => section.id !== OVERVIEW_ID)
    .map((section) => ({
      id: section.id,
      title: section.title,
      summary: section.summary,
      href: section.state === 'planned' ? null : section.href,
      state: section.state,
      more: section.more ?? [],
      figure: FIGURES[section.id]?.(summary) ?? null,
    }));
}
