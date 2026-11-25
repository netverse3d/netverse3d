const STRUCTURAL_TAGS = new Set([
  'article',
  'aside',
  'body',
  'br',
  'canvas',
  'div',
  'em',
  'footer',
  'form',
  'header',
  'html',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'span',
  'strong',
  'time',
  'ul',
]);

const PUBLIC_ENTRIES = new Set([
  '@netverse/ui/react',
  '@netverse/ui/tokens.css',
  '@netverse/ui/components.css',
  '@netverse/ui/accent',
]);

const LAYOUT_PROPERTIES = [
  /^(display|position|top|right|bottom|left|inset(-[a-z-]+)?|z-index)$/,
  /^(grid(-[a-z-]+)?|flex(-[a-z-]+)?|gap|row-gap|column-gap|order)$/,
  /^(align|justify|place)-(items|content|self)$/,
  /^(margin|padding)(-[a-z-]+)?$/,
  /^((min|max)-)?(width|height|inline-size|block-size)$/,
  /^(overflow(-[xy])?|visibility|pointer-events|touch-action|user-select|cursor)$/,
  /^(box-sizing|aspect-ratio|isolation|contain|transform|translate|white-space|text-align|text-overflow|list-style)$/,
];

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function checkScreenSource(source, path, registeredNames) {
  const violations = [];
  for (const match of source.matchAll(/(?<![\w$.)\]])<([a-z][a-z0-9]*)(?=[\s/>])/g)) {
    if (!STRUCTURAL_TAGS.has(match[1])) {
      violations.push(
        `${path}:${lineOf(source, match.index)} <${match[1]}> is not a structural tag; use a registered component from @netverse/ui/react`,
      );
    }
  }
  for (const match of source.matchAll(/\sstyle=\{/g)) {
    violations.push(
      `${path}:${lineOf(source, match.index)} inline style is not allowed in screens`,
    );
  }
  for (const match of source.matchAll(/['"`][^'"`\n]*\bnv-[a-z]/g)) {
    violations.push(
      `${path}:${lineOf(source, match.index)} nv-* classes belong to @netverse/ui components`,
    );
  }
  for (const match of source.matchAll(
    /import\s+(type\s+)?(?:\{([^}]*)\}|[\w*\s]+)\s+from\s+'(@netverse\/ui[^']*)'/g,
  )) {
    const [, typeOnly, names = '', specifier] = match;
    const line = lineOf(source, match.index);
    if (!PUBLIC_ENTRIES.has(specifier)) {
      violations.push(`${path}:${line} ${specifier} is not a public entry of @netverse/ui`);
      continue;
    }
    if (specifier !== '@netverse/ui/react' || typeOnly) continue;
    for (const raw of names.split(',')) {
      const name = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0];
      if (!name || raw.trim().startsWith('type ')) continue;
      if (!registeredNames.has(name)) {
        violations.push(`${path}:${line} ${name} is not in the component registry`);
      }
    }
  }
  return violations;
}

export function checkModuleCss(source, path) {
  const violations = [];
  for (const match of source.matchAll(/(?:^|[;{])\s*([a-z-]+)\s*:\s*([^;{}]+);/gm)) {
    const [, property, value] = match;
    const line = lineOf(source, match.index);
    if (!LAYOUT_PROPERTIES.some((pattern) => pattern.test(property))) {
      violations.push(`${path}:${line} ${property} is visual; screens may only lay out components`);
    } else if (property === 'z-index' && !/^var\(--ui-layer-[\w-]+\)$/.test(value.trim())) {
      violations.push(`${path}:${line} z-index must use a --ui-layer-* token`);
    }
  }
  return violations;
}
