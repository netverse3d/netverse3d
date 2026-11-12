const REQUIRED_FIELDS = ['name', 'component', 'owner', 'remove_by', 'summary'];
const FLAG_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FLAG_USAGE = /\b(?:NEXT_PUBLIC_)?FLAG_([A-Z][A-Z0-9_]*)\b/g;

export function envNameOf(name) {
  return `FLAG_${name.replaceAll('-', '_').toUpperCase()}`;
}

export function validateFlags(flags, componentIds, today) {
  const errors = [];
  const seen = new Set();
  for (const flag of flags) {
    const label = flag.name ?? '(missing name)';
    for (const field of REQUIRED_FIELDS) {
      if (!flag[field]) errors.push(`${label}: missing ${field}`);
    }
    if (flag.name && !FLAG_NAME.test(flag.name)) {
      errors.push(`${label}: name must be lowercase words joined by hyphens`);
    }
    if (seen.has(flag.name)) errors.push(`${label}: duplicate flag`);
    seen.add(flag.name);
    if (flag.component && !componentIds.includes(flag.component)) {
      errors.push(`${label}: component "${flag.component}" is not in docs/catalog.yaml`);
    }
    if (!flag.remove_by) continue;
    const removeBy = String(flag.remove_by);
    if (!ISO_DATE.test(removeBy)) {
      errors.push(`${label}: remove_by must look like 2027-01-31`);
    } else if (removeBy < today) {
      errors.push(
        `${label}: passed its removal date ${removeBy}; remove the flag or move the date`,
      );
    }
  }
  return errors;
}

export function findFlagUsages(files) {
  const usages = [];
  for (const file of files) {
    const names = new Set(
      [...file.text.matchAll(FLAG_USAGE)].map((match) =>
        match[1].toLowerCase().replaceAll('_', '-'),
      ),
    );
    for (const name of names) usages.push({ name, path: file.path });
  }
  return usages;
}

export function checkUsages(usages, flags) {
  const declared = new Set(flags.map((flag) => flag.name));
  const used = new Set(usages.map((usage) => usage.name));
  return [
    ...usages
      .filter((usage) => !declared.has(usage.name))
      .map((usage) => `${usage.path}: flag "${usage.name}" is not declared in docs/flags.yaml`),
    ...flags
      .filter((flag) => flag.name && !used.has(flag.name))
      .map((flag) => `${flag.name}: declared but no code reads ${envNameOf(flag.name)}`),
  ];
}
