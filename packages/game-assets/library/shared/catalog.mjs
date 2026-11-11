export const SECTION_STATES = ['rebuilt', 'legacy', 'planned'];
export const STAGE_PAGE = 'view.html';

const OVERVIEW_ID = 'overview';
const EXPRESSION_PREFIX = 'ex_';
export const ROOM_KIT = 'room-kit.glb';
const FRAMED_MARK = 'framed';
const STAGE_PARAMS = ['section', 'page'];
const FIGURES = {
  characters: (summary) => ({ value: summary.actions, unit: 'actions' }),
  parts: (summary) => ({ value: summary.partVariants, unit: 'variants' }),
  rooms: (summary) => ({ value: summary.roomVariants, unit: 'modules' }),
  shops: (summary) => ({ value: summary.shops, unit: 'shops' }),
};

function variantsOf(kit) {
  return Object.values(kit?.slots ?? {}).reduce(
    (total, slot) => total + (slot.variants?.length ?? 0),
    0,
  );
}

function splitSource(src) {
  const [beforeHash, hash = ''] = src.split('#');
  const [file, query = ''] = beforeHash.split('?');
  return { file, query, hash: hash ? `#${hash}` : '' };
}

export function catalogSummary(config, recipeIds) {
  const kits = config.kits ?? [];
  const clips = config.clips ?? [];
  const expressions = clips.filter((clip) => clip.startsWith(EXPRESSION_PREFIX)).length;
  const kitNamed = (file) => kits.find((kit) => kit.file === file);
  return {
    slots: kits.reduce((total, kit) => total + Object.keys(kit.slots ?? {}).length, 0),
    variants: kits.reduce((total, kit) => total + variantsOf(kit), 0),
    partVariants: kits
      .filter((kit) => kit.file !== ROOM_KIT)
      .reduce((total, kit) => total + variantsOf(kit), 0),
    roomVariants: variantsOf(kitNamed(ROOM_KIT)),
    actions: clips.length - expressions,
    expressions,
    shops: recipeIds.length,
    scenes: (config.scenes ?? []).length,
  };
}

export function pageHref(section, page) {
  const base = `${STAGE_PAGE}?section=${section.id}`;
  return page > 0 ? `${base}&page=${page}` : base;
}

export function sectionHref(section) {
  if (section.state === 'planned') return null;
  return section.state === 'legacy' ? pageHref(section, 0) : section.href;
}

export function navItems(sections, currentId) {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    href: sectionHref(section),
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
      href: sectionHref(section),
      state: section.state,
      more: (section.pages ?? [])
        .map((page, index) => ({ title: page.title, href: pageHref(section, index) }))
        .slice(section.state === 'legacy' ? 1 : 0),
      figure: FIGURES[section.id]?.(summary) ?? null,
    }));
}

export function stageTarget(sections, search) {
  const framed = sections.filter((section) => (section.pages ?? []).length > 0);
  const params = new URLSearchParams(search);
  const section = framed.find((item) => item.id === params.get('section')) ?? framed[0];
  const asked = Number(params.get('page') ?? 0);
  const page = Number.isInteger(asked) && asked >= 0 && asked < section.pages.length ? asked : 0;
  return { section: section.id, page };
}

export function sectionTabs(section, current, mainTitle) {
  const main = section.href
    ? [{ title: mainTitle, href: section.href, page: null, current: current === 'main' }]
    : [];
  return [
    ...main,
    ...(section.pages ?? []).map((page, index) => ({
      title: page.title,
      href: pageHref(section, index),
      page: index,
      current: current === index,
    })),
  ];
}

export function carriedQuery(search) {
  const params = new URLSearchParams(search);
  for (const name of STAGE_PARAMS) params.delete(name);
  return params.toString();
}

export function framedSource(src, page, carried = '') {
  const { file, query, hash } = splitSource(src);
  const mark = `${FRAMED_MARK}=${page}`;
  if (carried === '') return `${file}?${query ? `${query}&` : ''}${mark}${hash}`;
  const params = new URLSearchParams(query);
  for (const [name, value] of new URLSearchParams(carried)) params.set(name, value);
  return `${file}?${params.toString()}&${mark}${hash}`;
}

export function whereIs(sections, file, hash, currentId) {
  const matches = sections.flatMap((section) =>
    (section.pages ?? [])
      .map((page, index) => ({ section: section.id, page: index, ...splitSource(page.src) }))
      .filter((page) => page.file === file),
  );
  if (matches.length === 0) return null;
  const pick =
    matches.find((match) => match.section === currentId && match.hash === hash) ??
    matches.find((match) => match.section === currentId) ??
    matches.find((match) => match.hash === hash) ??
    matches[0];
  return { section: pick.section, page: pick.page };
}
