import { componentProps, registeredComponents } from '../src/registry.mjs';

const union = (values) => values.map((value) => `'${value}'`).join(' | ');

export function renderReactTypes(registry) {
  const lines = [];
  for (const entry of registeredComponents(registry)) {
    const props = componentProps(registry, entry);
    lines.push(`export interface ${entry.react}Variants {`);
    for (const [name, values] of Object.entries(props)) lines.push(`  ${name}?: ${union(values)};`);
    lines.push('}', '');
  }
  lines.push('export const VARIANTS = {');
  for (const entry of registeredComponents(registry)) {
    lines.push(`  ${entry.react}: ${JSON.stringify(componentProps(registry, entry))},`);
  }
  lines.push('} as const;', '');
  return lines.join('\n');
}
