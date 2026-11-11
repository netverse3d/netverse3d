import { SECTION_STATES, catalogSummary, kitIndex, sectionCards } from './catalog.mjs';
import { element, loadShell, mountNav, readJson, stateBadge } from './shell.mjs';

const STAT_ORDER = ['variants', 'slots', 'actions', 'expressions', 'shops', 'scenes'];
const PACKAGE_ROOT = new URL('../../', import.meta.url);

function statItem(value, label) {
  return element('li', { class: 'stat' }, [
    element('b', {}, value.toLocaleString('vi-VN')),
    element('span', {}, label),
  ]);
}

function cardOf(card, text) {
  const figure = card.figure
    ? [
        element(
          'span',
          { class: 'card-figure' },
          `${card.figure.value.toLocaleString('vi-VN')} ${text.units[card.figure.unit]}`,
        ),
      ]
    : [];
  const actions = card.href
    ? [
        element('a', { class: 'button', 'data-kind': 'main', href: card.href }, text.open),
        ...card.more.map((link) =>
          element('a', { class: 'button', 'data-kind': 'quiet', href: link.href }, link.title),
        ),
      ]
    : [];
  return element('article', { class: 'card', 'data-state': card.state, id: `card-${card.id}` }, [
    element('div', { class: 'card-top' }, [
      element('h3', {}, card.title),
      stateBadge(card.state, text),
    ]),
    element('p', {}, card.summary),
    ...figure,
    element('div', { class: 'card-actions' }, actions),
  ]);
}

async function main() {
  const stats = document.getElementById('stats');
  const cards = document.getElementById('cards');
  const legend = document.getElementById('legend');
  try {
    const shell = await loadShell();
    mountNav(document.getElementById('nav'), shell, 'overview');
    const [config, recipes] = await Promise.all([
      readJson(new URL('assets.config.json', PACKAGE_ROOT)),
      readJson(new URL('recipes/index.json', PACKAGE_ROOT)),
    ]);
    const summary = catalogSummary(config, recipes);
    stats.replaceChildren(
      ...STAT_ORDER.map((key) => statItem(summary[key], shell.text.stats[key])),
    );
    cards.replaceChildren(
      ...sectionCards(shell.sections, summary, config).map((card) => cardOf(card, shell.text)),
    );
    const words = shell.text.index;
    document
      .getElementById('index-head')
      .replaceChildren(
        ...[words.kit, words.slots, words.variants, words.section].map((label) =>
          element('th', { scope: 'col' }, label),
        ),
      );
    document
      .getElementById('index-rows')
      .replaceChildren(
        ...kitIndex(config, shell.sections).map((row) =>
          element('tr', {}, [
            element('th', { scope: 'row' }, [
              shell.text.parts.kits[row.file] ?? row.file,
              element('small', {}, row.file),
            ]),
            element('td', {}, row.slots.toLocaleString('vi-VN')),
            element('td', {}, row.variants.toLocaleString('vi-VN')),
            element(
              'td',
              {},
              row.href ? element('a', { href: row.href }, row.title) : words.missing,
            ),
          ]),
        ),
      );
    legend.replaceChildren(
      ...SECTION_STATES.map((state) =>
        element('li', {}, [stateBadge(state, shell.text), shell.text.stateNotes[state]]),
      ),
    );
    document.body.dataset.ready = 'true';
  } catch (reason) {
    console.error(reason);
    document.body.dataset.ready = 'failed';
    document.getElementById('problem').hidden = false;
  }
}

main();
