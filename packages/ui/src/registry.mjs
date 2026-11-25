export function componentProps(registry, entry) {
  return Object.assign({}, ...entry.uses.map((name) => registry.propSets[name]), entry.props);
}

export function registeredComponents(registry) {
  return registry.components.filter((entry) => entry.kind === 'component');
}
