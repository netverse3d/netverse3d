import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';

const RECIPE_FOLDER = 'recipes';
const RECIPE_SCHEMA = createRequire(import.meta.url).resolve(
  '@netverse/contracts/world/shop-look.v1.schema.json',
);
const WALL_AXIS = { north: 0, south: 0, east: 1, west: 1 };

let validateRecipe;

function recipeValidator() {
  if (!validateRecipe) {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    validateRecipe = ajv.compile(JSON.parse(readFileSync(RECIPE_SCHEMA, 'utf8')));
  }
  return validateRecipe;
}

function checkRecipeShape(recipe, label) {
  const validate = recipeValidator();
  if (validate(recipe)) return [];
  return validate.errors.map((error) => `${label}: ${error.instancePath || '/'} ${error.message}`);
}

function checkRecipePalette(recipe, palette, label) {
  const rows = [...palette.surface, ...palette.glow];
  const keys = Object.keys(recipe.palette);
  const complete = keys.length === rows.length && rows.every((row) => keys.includes(row));
  const errors = complete ? [] : [`${label}: palette rows must be ${rows.join(', ')}`];
  for (const row of Object.keys(recipe.emissive ?? {})) {
    if (!palette.surface.includes(row)) {
      errors.push(`${label}: emissive row ${row} is not a surface row`);
    }
  }
  return errors;
}

function checkRecipeVariants(recipe, kits, label) {
  const errors = [];
  const slots = new Map(kits.flatMap((kit) => Object.entries(kit.slots)));
  for (const [slot, spec] of slots) {
    const variant = recipe.variants[slot];
    if (variant === undefined) errors.push(`${label}: no variant chosen for slot ${slot}`);
    else if (!spec.variants.includes(variant)) {
      errors.push(`${label}: slot ${slot} has no variant ${variant}`);
    }
  }
  for (const slot of Object.keys(recipe.variants)) {
    if (!slots.has(slot)) errors.push(`${label}: unknown slot ${slot}`);
  }
  return errors;
}

function cellInsideOpening({ wall, at }, [width, depth]) {
  return { north: [at, 0], south: [at, depth - 1], west: [0, at], east: [width - 1, at] }[wall];
}

function checkRecipeLayout(recipe, label) {
  const errors = [];
  const { cells, stations, door, windows = [] } = recipe.layout;
  const [width, depth] = cells;
  const taken = new Set();
  const doorway = cellInsideOpening(door, cells).join(',');
  for (const { cell } of stations) {
    const [x, z] = cell;
    const key = cell.join(',');
    if (x >= width || z >= depth) {
      errors.push(`${label}: station at ${key} is outside the ${width} x ${depth} room`);
    }
    if (taken.has(key)) errors.push(`${label}: two stations share cell ${key}`);
    if (key === doorway) errors.push(`${label}: station at ${key} blocks the door`);
    taken.add(key);
  }
  const placed = new Set();
  for (const [kind, opening] of [['door', door], ...windows.map((w) => ['window', w])]) {
    const place = `${opening.wall} ${opening.at}`;
    if (opening.at >= cells[WALL_AXIS[opening.wall]]) {
      errors.push(`${label}: ${kind} at ${opening.at} is outside the ${opening.wall} wall`);
    }
    if (placed.has(place)) errors.push(`${label}: two openings share ${place}`);
    placed.add(place);
  }
  return errors;
}

export function listRecipes(root) {
  const folder = join(root, RECIPE_FOLDER);
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(folder, name));
}

export function checkRecipes(root, config) {
  const errors = [];
  for (const path of listRecipes(root)) {
    const file = basename(path);
    let recipe;
    try {
      recipe = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      errors.push(`${file}: invalid JSON`);
      continue;
    }
    const shape = checkRecipeShape(recipe, typeof recipe?.id === 'string' ? recipe.id : file);
    if (shape.length > 0) {
      errors.push(...shape);
      continue;
    }
    if (`${recipe.id}.json` !== file) {
      errors.push(`${file}: id ${recipe.id} does not match the file name`);
    }
    errors.push(
      ...checkRecipePalette(recipe, config.palette, recipe.id),
      ...checkRecipeVariants(recipe, config.kits ?? [], recipe.id),
      ...checkRecipeLayout(recipe, recipe.id),
    );
  }
  return errors;
}
