import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createSidewalkBots } from './sidewalk-bots.mjs';

const alley = JSON.parse(readFileSync(new URL('../blocks/hem-mau.json', import.meta.url)));

test('Bot đi và dừng trên vỉa hè hẻm mẫu, giữ khoảng cách khi chạy nhiều vòng', () => {
  const { poses, update } = createSidewalkBots(alley);
  assert.equal(poses.length, 2);
  const visited = poses.map(() => new Set());
  const rested = poses.map(() => false);
  for (let frame = 0; frame < 1800; frame += 1) {
    update(1 / 30);
    for (const [index, pose] of poses.entries()) {
      assert.ok(pose.x >= -8 && pose.x <= 8);
      assert.ok(pose.z >= 2 && pose.z <= 3);
      assert.equal(pose.y, 0.15);
      visited[index].add(Math.floor(pose.x));
      rested[index] ||= !pose.walking;
    }
    assert.ok(Math.hypot(poses[0].x - poses[1].x, poses[0].z - poses[1].z) >= 0.52);
  }
  assert.ok(visited.every((sections) => sections.size >= 14));
  assert.ok(rested.every(Boolean));
});

test('Bot nhường người chơi và tiếp tục đi khi lối trống', () => {
  const block = { ...alley, sidewalks: alley.sidewalks.slice(0, 1) };
  const {
    poses: [bot],
    update,
  } = createSidewalkBots(block);
  const player = { x: bot.x + 1, z: bot.z };
  for (let frame = 0; frame < 60; frame += 1) update(1 / 30, player);
  assert.ok(player.x - bot.x >= 0.85);
  assert.ok(player.x - bot.x < 0.9);
  assert.equal(bot.walking, false);
  for (let frame = 0; frame < 120; frame += 1) update(1 / 30);
  assert.ok(bot.x > player.x);
});

test('Bot không nối hai đoạn vỉa hè qua ô bị thiếu hoặc qua lòng đường', () => {
  const block = {
    ...alley,
    sidewalks: [alley.sidewalks[0], alley.sidewalks[2], { cell: [0, 2], side: 'south' }],
  };
  const { poses, update } = createSidewalkBots(block);
  assert.equal(poses.length, 3);
  for (let frame = 0; frame < 600; frame += 1) {
    update(1 / 30);
    assert.ok(poses[0].x < -4 && poses[0].z < 3);
    assert.ok(poses[1].x > 0 && poses[1].x < 4 && poses[1].z < 3);
    assert.ok(poses[2].x < -4 && poses[2].z > 5);
  }
  assert.deepEqual(createSidewalkBots({ ...block, sidewalks: [] }).poses, []);
});
