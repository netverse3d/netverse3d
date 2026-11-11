import { framedSource, pageHref, stageTarget, whereIs } from './catalog.mjs';
import { element, loadShell, mountNav, stateBadge } from './shell.mjs';

const OLD_FRAME_RULES = {
  'studio.html': '.brand, .tabs { display: none !important; }',
};
const OLD_HEADING_RULE = 'h1, h1 + p { display: none !important; }';
const OVERVIEW_FILE = 'index.html';

function fileOf(pathname) {
  return pathname.split('/').pop() || OVERVIEW_FILE;
}

async function main() {
  const shell = await loadShell();
  const { sections, text } = shell;
  const nav = document.getElementById('nav');
  const title = document.getElementById('stage-title');
  const badge = document.getElementById('stage-badge');
  const summary = document.getElementById('stage-summary');
  const tabs = document.getElementById('stage-tabs');
  const alone = document.getElementById('stage-alone');
  const frame = document.getElementById('stage-frame');
  let current = stageTarget(sections, window.location.search);
  let loaded = false;

  const sectionNow = () => sections.find((section) => section.id === current.section);

  function drawFrameChrome() {
    const section = sectionNow();
    const page = section.pages[current.page];
    mountNav(nav, shell, section.id);
    title.textContent = section.title;
    summary.textContent = section.summary;
    badge.replaceChildren(stateBadge(section.state, text));
    tabs.replaceChildren(
      ...section.pages.map((item, index) => {
        const tab = element(
          'a',
          {
            class: 'stage-tab',
            href: pageHref(section, index),
            'aria-current': index === current.page ? 'page' : null,
          },
          item.title,
        );
        tab.addEventListener('click', (event) => {
          event.preventDefault();
          show({ section: section.id, page: index });
        });
        return tab;
      }),
    );
    tabs.hidden = section.pages.length < 2;
    alone.href = page.src;
    document.title = `${section.title} · ${page.title} · ${text.brand}`;
  }

  function load() {
    const page = sectionNow().pages[current.page];
    const source = framedSource(page.src, current.page);
    frame.title = page.title;
    if (loaded) frame.contentWindow.location.replace(new URL(source, window.location.href));
    else frame.src = source;
    loaded = true;
  }

  function show(target) {
    current = target;
    window.history.pushState(null, '', pageHref(sectionNow(), current.page));
    drawFrameChrome();
    load();
  }

  frame.addEventListener('load', () => {
    const inside = frame.contentWindow.location;
    const file = fileOf(inside.pathname);
    if (file === OVERVIEW_FILE) {
      window.location.replace(OVERVIEW_FILE);
      return;
    }
    const style = frame.contentDocument.createElement('style');
    style.textContent = OLD_FRAME_RULES[file] ?? OLD_HEADING_RULE;
    frame.contentDocument.head.append(style);
    const found = whereIs(sections, file, inside.hash, current.section);
    if (!found || (found.section === current.section && found.page === current.page)) return;
    current = found;
    window.history.replaceState(null, '', pageHref(sectionNow(), current.page));
    drawFrameChrome();
  });

  window.addEventListener('popstate', () => {
    current = stageTarget(sections, window.location.search);
    drawFrameChrome();
    load();
  });

  drawFrameChrome();
  load();
  document.body.dataset.ready = 'true';
}

main().catch((reason) => {
  console.error(reason);
  document.body.dataset.ready = 'failed';
  document.getElementById('problem').hidden = false;
});
