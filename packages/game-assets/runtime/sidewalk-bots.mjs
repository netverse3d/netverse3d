import { SIDEWALK_TOP, STREET_CELL, sidewalkPlacements } from './street-look.mjs';
import { hashSeed } from './weather.mjs';

const LANE_OFFSET = 0.28;
const BOT_CLEARANCE = 0.52;
const PLAYER_CLEARANCE = 0.85;
const WALK_SPEED = 1.2;

function sidewalkRoutes(block) {
  const lines = new Map();
  for (const {
    position: [x, , z],
    yaw,
  } of sidewalkPlacements(block)) {
    const horizontal = Math.abs(Math.cos(yaw)) > 0.5;
    const [along, across] = horizontal ? [x, z] : [z, x];
    const key = `${horizontal}:${across}`;
    if (!lines.has(key)) lines.set(key, { horizontal, across, centres: new Set() });
    lines.get(key).centres.add(along);
  }
  const routes = [];
  for (const { horizontal, across, centres } of lines.values()) {
    const sorted = [...centres].sort((a, b) => a - b);
    let start = 0;
    for (let end = 1; end <= sorted.length; end += 1) {
      if (sorted[end] === sorted[end - 1] + STREET_CELL) continue;
      const stops = sorted.slice(start, end);
      const turn = STREET_CELL / 2 - LANE_OFFSET;
      const ends = [stops[0] - turn, stops.at(-1) + turn];
      const lane = (along, offset) =>
        horizontal ? [along, across + offset] : [across + offset, along];
      routes.push({
        count: Math.ceil(stops.length / 2),
        points: [
          lane(ends[0], -LANE_OFFSET),
          ...stops.map((along) => lane(along, -LANE_OFFSET)),
          lane(ends[1], -LANE_OFFSET),
          lane(ends[1], LANE_OFFSET),
          ...[...stops].reverse().map((along) => lane(along, LANE_OFFSET)),
          lane(ends[0], LANE_OFFSET),
        ],
        stops: new Set(stops),
        axis: horizontal ? 0 : 1,
      });
      start = end;
    }
  }
  return routes;
}

function canAdvance(bot, x, z, other, clearance) {
  const distance = Math.hypot(x - other.x, z - other.z);
  return distance >= clearance || distance > Math.hypot(bot.x - other.x, bot.z - other.z);
}

export function createSidewalkBots(block) {
  const bots = sidewalkRoutes(block).flatMap((route) =>
    Array.from({ length: route.count }, (_, index) => {
      const current = Math.floor((index * route.points.length) / route.count);
      const [x, z] = route.points[current];
      const target = (current + 1) % route.points.length;
      const [nextX, nextZ] = route.points[target];
      return {
        route,
        target,
        speed: WALK_SPEED * (0.85 + hashSeed(block.id, current) * 0.3),
        arrivals: 0,
        pause: 0,
        pose: { x, y: SIDEWALK_TOP, z, yaw: Math.atan2(nextX - x, nextZ - z), walking: false },
      };
    }),
  );
  const poses = bots.map(({ pose }) => pose);

  function tick(delta, player) {
    for (const [index, bot] of bots.entries()) {
      const { pose, route } = bot;
      pose.walking = false;
      if (bot.pause > 0) {
        bot.pause = Math.max(0, bot.pause - delta);
        continue;
      }
      const target = route.points[bot.target];
      const dx = target[0] - pose.x;
      const dz = target[1] - pose.z;
      const distance = Math.hypot(dx, dz);
      const travel = Math.min(distance, bot.speed * delta);
      const x = travel === distance ? target[0] : pose.x + (dx * travel) / distance;
      const z = travel === distance ? target[1] : pose.z + (dz * travel) / distance;
      if (player && !canAdvance(pose, x, z, player, PLAYER_CLEARANCE)) continue;
      if (poses.some((other) => other !== pose && !canAdvance(pose, x, z, other, BOT_CLEARANCE))) {
        continue;
      }
      if (travel > 0) pose.yaw = Math.atan2(dx, dz);
      Object.assign(pose, { x, z, walking: travel > 0 });
      if (travel < distance) continue;
      bot.target = (bot.target + 1) % route.points.length;
      if (!route.stops.has(target[route.axis])) continue;
      const roll = hashSeed(`${block.id}:${index}`, bot.arrivals++);
      if (roll < 0.55) bot.pause = 0.35 + roll * 2.5;
    }
  }

  return {
    poses,
    update(delta, player = null) {
      for (let remaining = Math.min(delta, 0.25); remaining > 0; remaining -= 0.05) {
        tick(Math.min(remaining, 0.05), player);
      }
    },
  };
}
