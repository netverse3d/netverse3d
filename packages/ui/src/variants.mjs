import { componentProps } from './registry.mjs';

export function variantOptions(registry, reactName) {
  const entry = registry.components.find((item) => item.react === reactName);
  if (!entry) throw new Error(`Unregistered component: ${reactName}`);
  return componentProps(registry, entry);
}

export function variantData(props, options) {
  const data = {};
  for (const [name, values] of Object.entries(options)) {
    const value = props[name];
    if (value === undefined || value === values[0]) continue;
    if (!values.includes(value)) throw new Error(`Unsupported ${name}: ${value}`);
    data[`data-${name}`] = value;
  }
  return data;
}
