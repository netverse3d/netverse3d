import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { doorwayCell } from '../runtime/shop-look.mjs';

const RECIPE_FOLDER = 'recipes';
const INDEX_FILE = 'index.json';
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

function checkRecipeLayout(recipe, label) {
  const errors = [];
  const { cells, stations, door, windows = [] } = recipe.layout;
  const [width, depth] = cells;
  const taken = new Set();
  const doorway = doorwayCell(door, cells).join(',');
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
    .filter((name) => name.endsWith('.json') && name !== INDEX_FILE)
    .map((name) => join(folder, name));
}

function checkIndex(root, files) {
  const label = `${RECIPE_FOLDER}/${INDEX_FILE}`;
  const path = join(root, RECIPE_FOLDER, INDEX_FILE);
  if (!existsSync(path)) return [`${label} is missing`];
  let listed;
  try {
    listed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [`${label}: invalid JSON`];
  }
  if (!Array.isArray(listed)) return [`${label} must be an array of recipe ids`];
  const ids = files.map((path) => basename(path, '.json'));
  return [
    ...listed
      .filter((id, index) => listed.indexOf(id) !== index)
      .map((id) => `${INDEX_FILE} lists ${id} twice`),
    ...listed
      .filter((id) => !ids.includes(id))
      .map((id) => `${INDEX_FILE} lists ${id} but ${RECIPE_FOLDER}/${id}.json does not exist`),
    ...ids.filter((id) => !listed.includes(id)).map((id) => `${id} is not listed in ${label}`),
  ];
}

export function checkRecipes(root, config) {
  const files = listRecipes(root);
  if (!existsSync(join(root, RECIPE_FOLDER))) return [];
  const errors = checkIndex(root, files);
  for (const path of files) {
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
