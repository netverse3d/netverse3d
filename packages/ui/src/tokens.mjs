const MEDIA_BLOCK = /@media\s*([^{]+)\{\s*([^{}]+)\{([^{}]*)\}\s*\}/g;
const RULE_BLOCK = /([^{}]+)\{([^{}]*)\}/g;
const DECLARATION = /(--ui-[\w-]+)\s*:\s*([^;]+);/g;
const REFERENCE = /^var\((--ui-[\w-]+)\)$/;

function declarations(body) {
  return Object.fromEntries(
    [...body.matchAll(DECLARATION)].map(([, name, value]) => [name, value.trim()]),
  );
}

export function parseTokenRules(css) {
  const rules = [];
  const withoutMedia = css.replace(MEDIA_BLOCK, (_, media, selector, body) => {
    rules.push({ media: media.trim(), selector: selector.trim(), values: declarations(body) });
    return '';
  });
  for (const [, selector, body] of withoutMedia.matchAll(RULE_BLOCK)) {
    if (selector.trim().startsWith('@')) continue;
    rules.push({ media: null, selector: selector.trim(), values: declarations(body) });
  }
  return rules;
}

export function tokenDefaults(rules) {
  return Object.assign(
    {},
    ...rules.filter((rule) => !rule.media && rule.selector === ':root').map((rule) => rule.values),
  );
}

export function tokenOverrides(rules, matches) {
  return Object.assign({}, ...rules.filter(matches).map((rule) => rule.values));
}

export function resolveToken(name, values, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Token cycle at ${name}`);
  const value = values[name];
  const reference = REFERENCE.exec(value ?? '');
  return reference ? resolveToken(reference[1], values, new Set([...seen, name])) : value;
}
