const MODULE = 4;

export const MIDRISE_RECIPES = [
  { origin: -16, floors: 6, width: 2, depth: 2, face: 'aaaaab', palette: 'cam-retro', roof: 'b' },
  { origin: 0, floors: 9, width: 3, depth: 2, face: 'bbbbabbb', palette: 'bien-sau', roof: 'a' },
  { origin: 20, floors: 12, width: 3, depth: 3, face: 'aababb', palette: 'tim-neon', roof: 'a' },
];

export function midrisePlan(recipe) {
  const { origin, floors, width, depth, face, palette, roof } = recipe;
  const w = (width * MODULE) / 2;
  const d = (depth * MODULE) / 2;
  const plan = [];
  for (let level = 0; level < floors; level += 1) {
    const y = level * MODULE;
    for (let column = 0; column < width; column += 1) {
      const x = origin - w + (column + 0.5) * MODULE;
      const variant = face[(level + column) % face.length];
      const front =
        level === 0 ? `midrise_ground_${column === 0 ? 'b' : 'a'}` : `midrise_floor_${variant}`;
      plan.push([front, [x, y, d], 0, palette]);
      plan.push([
        level === 0 ? 'midrise_ground_a' : 'midrise_floor_b',
        [x, y, -d],
        Math.PI,
        palette,
      ]);
    }
    for (let row = 0; row < depth; row += 1) {
      const z = -d + (row + 0.5) * MODULE;
      const part = level === 0 ? 'midrise_ground_a' : `midrise_floor_${face[level % face.length]}`;
      plan.push([part, [origin - w, y, z], -Math.PI / 2, palette]);
      plan.push([part, [origin + w, y, z], Math.PI / 2, palette]);
    }
  }
  for (let column = 0; column < width; column += 1) {
    for (let row = 0; row < depth; row += 1) {
      plan.push([
        `midrise_roof_${roof}`,
        [origin - w + (column + 0.5) * MODULE, floors * MODULE, -d + (row + 0.5) * MODULE],
        0,
        palette,
      ]);
    }
  }
  return plan;
}
