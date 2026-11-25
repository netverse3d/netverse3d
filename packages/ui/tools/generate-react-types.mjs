import { writeFileSync } from 'node:fs';
import { loadRegistry } from '../src/registry-file.mjs';
import { renderReactTypes } from './react-types.mjs';

const target = new URL('../react/variants.generated.ts', import.meta.url);
writeFileSync(target, renderReactTypes(loadRegistry()));
console.log('Wrote react/variants.generated.ts from the component registry.');
