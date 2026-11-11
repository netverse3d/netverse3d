import { navItems } from './catalog.mjs';

const SHARED = new URL('./', import.meta.url);

export async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) node.setAttribute(name, value);
  }
  for (const child of [children].flat()) {
    node.append(child);
  }
  return node;
}

export function stateBadge(state, text) {
  return element('span', { class: 'badge', 'data-state': state }, text.states[state]);
}

export async function loadShell() {
  const [sections, text] = await Promise.all([
    readJson(new URL('sections.json', SHARED)),
    readJson(new URL('text.json', SHARED)),
  ]);
  return { sections, text };
}

export function mountNav(target, { sections, text }, currentId) {
  const links = navItems(sections, currentId).map((item) => {
    const badge = item.state === 'rebuilt' ? [] : [stateBadge(item.state, text)];
    const link = item.href
      ? element(
          'a',
          {
            class: 'gallery-link',
            href: item.href,
            'aria-current': item.current ? 'page' : null,
          },
          [item.title, ...badge],
        )
      : element('span', { class: 'gallery-link', 'aria-disabled': 'true' }, [item.title, ...badge]);
    return element('li', {}, link);
  });
  target.replaceChildren(
    element('a', { class: 'gallery-brand', href: 'index.html' }, [
      element('b', {}, text.brand),
      element('span', {}, text.brandNote),
    ]),
    element(
      'nav',
      { 'aria-label': text.navLabel },
      element('ul', { class: 'gallery-links' }, links),
    ),
    element('p', { class: 'gallery-foot' }, text.foot),
  );
}
