import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, VoxelGrid } from '../src/core/grid.js';
import { addHoles } from '../src/core/holes.js';
import { removeFloating } from '../src/core/connect.js';
import { makeRandom } from '../src/core/random.js';
import { FACE_NORMALS, STICKER_TYPES } from '../src/core/decorate.js';
import { hardnessOf, STONE_NAMES } from '../src/core/stones.js';
import {
  OPS, MAX_STEPS, makeStep, applyStep, encodeSteps, decodeSteps, encodeReplay, decodeReplay, replayMatches,
} from '../src/core/replay.js';

// Play a random game, the same way as the game: keep each step that
// changes something.
function playRandom(stone, seed, count) {
  const rand = makeRandom(seed);
  const grid = createBlock({ hardness: hardnessOf(stone) });
  if (stone === 'cheese') {
    addHoles(grid, { count: 12, rand });
    removeFloating(grid);
  }
  const start = grid.cells.slice();
  let stickers = [];
  const steps = [];
  const tools = ['hammer', 'hammer', 'chisel', 'file', 'clay', 'brush', 'sticker'];
  for (let k = 0; k < count; k++) {
    const tool = tools[Math.floor(rand() * tools.length)];
    const face = Math.floor(rand() * 6);
    const [x, y, z] = [Math.floor(rand() * 32), 1 + Math.floor(rand() * 31), Math.floor(rand() * 32)];
    const step = makeStep(tool, x, y, z, {
      easy: rand() < 0.3, face, paint: Math.floor(rand() * 9),
      sticker: STICKER_TYPES[Math.floor(rand() * STICKER_TYPES.length)],
    });
    const result = applyStep(grid, stickers, step, stone);
    if (!result.changed) continue;
    stickers = result.stickers;
    steps.push(step);
  }
  return { grid, start, steps, stickers };
}

for (const stone of STONE_NAMES) {
  test(`a replay of ${stone} gives the same statue`, () => {
    const game = playRandom(stone, stone.length * 31, 400);
    assert.ok(game.steps.length > 50);
    const replay = decodeReplay(JSON.parse(JSON.stringify(encodeReplay(game.start, game.steps))), 32);
    const grid = new VoxelGrid(32);
    grid.cells.set(replay.start);
    let stickers = [];
    for (const step of replay.steps) stickers = applyStep(grid, stickers, step, stone).stickers;
    assert.deepEqual(grid.cells, game.grid.cells);
    assert.deepEqual(grid.paint, game.grid.paint);
    assert.deepEqual(stickers, game.stickers);
    assert.equal(replayMatches(new VoxelGrid(32), replay, stone, game.grid.cells, game.grid.paint), true);
  });
}

test('a replay that does not match is found', () => {
  const game = playRandom('marble', 5, 120);
  const replay = decodeReplay(encodeReplay(game.start, game.steps), 32);
  const other = game.grid.cells.slice();
  other[other.findIndex((v) => v !== 0 && v !== 255)] = 0;
  assert.equal(replayMatches(new VoxelGrid(32), replay, 'marble', other), false);
});

test('each tool makes a step that the replay knows', () => {
  for (const tool of ['hammer', 'chisel', 'file', 'clay', 'brush', 'sticker']) {
    const step = makeStep(tool, 1, 2, 3, { face: 4, paint: 5, sticker: 'nonla' });
    assert.ok(OPS[step.op]);
  }
  assert.equal(OPS[makeStep('hammer', 0, 0, 0, { easy: true }).op], 'hammer-easy');
  assert.throws(() => makeStep('spoon', 0, 0, 0));
  const sticker = makeStep('sticker', 1, 2, 3, { face: 5, sticker: 'lantern' });
  assert.equal(sticker.arg & 7, 5);
  assert.equal(STICKER_TYPES[sticker.arg >> 3], 'lantern');
  assert.deepEqual(FACE_NORMALS[makeStep('clay', 0, 0, 0, { face: 2 }).arg], [0, 1, 0]);
});

test('bad steps are rejected', () => {
  const good = [{ op: 0, x: 1, y: 2, z: 3, arg: 0 }];
  assert.deepEqual(decodeSteps(encodeSteps(good), 32), good);
  for (const bad of [{ op: 99, x: 0, y: 0, z: 0, arg: 0 }, { op: 0, x: 40, y: 0, z: 0, arg: 0 }, { op: 5, x: 0, y: 0, z: 0, arg: 6 }, { op: 6, x: 0, y: 0, z: 0, arg: 9 }]) {
    assert.throws(() => decodeSteps(encodeSteps([bad]), 32));
  }
  assert.equal(decodeReplay({ start: 'bad*', steps: '' }, 32), null);
  assert.equal(decodeReplay(null, 32), null);
});

test('a very long carving has no time-lapse', () => {
  const steps = Array.from({ length: MAX_STEPS + 1 }, () => ({ op: 0, x: 0, y: 1, z: 0, arg: 0 }));
  assert.equal(encodeReplay(new Uint8Array(8), steps), null);
});
