import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, EMPTY } from '../src/core/grid.js';
import { makeRandom } from '../src/core/random.js';
import { applyHit } from '../src/core/carve.js';
import { buildGhost } from '../src/core/shapes.js';
import {
  TREASURES, TREASURE_IDS, pickTreasure, placeTreasures, isUncovered, collectUncovered,
  nearestOpening, loadCollection, addToCollection, COLLECTION_KEY,
} from '../src/core/treasures.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('each treasure has a unique id and a known rarity', () => {
  assert.equal(new Set(TREASURE_IDS).size, TREASURES.length);
  for (const t of TREASURES) assert.ok(['common', 'rare', 'super'].includes(t.rarity));
});

test('the same seed gives the same treasures', () => {
  const a = placeTreasures(createBlock(), { count: 3, rand: makeRandom(42) });
  const b = placeTreasures(createBlock(), { count: 3, rand: makeRandom(42) });
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
});

test('treasures are buried, apart, and out of the ghost shape', () => {
  const ghost = buildGhost('heart');
  const grid = createBlock({ box: ghost.box });
  for (let seed = 1; seed < 20; seed++) {
    const list = placeTreasures(grid, { count: 3, rand: makeRandom(seed), avoidMask: ghost.mask });
    for (const t of list) {
      assert.equal(isUncovered(grid, t), false);
      assert.equal(ghost.mask[grid.index(t.x, t.y, t.z)], 0);
      assert.ok(TREASURE_IDS.includes(t.id));
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = Math.abs(list[i].x - list[j].x) + Math.abs(list[i].y - list[j].y) + Math.abs(list[i].z - list[j].z);
        assert.ok(d >= 6);
      }
    }
  }
});

test('a hit next to a treasure finds it one time', () => {
  const grid = createBlock();
  const treasure = { id: 'gem', x: 10, y: 10, z: 10, found: false };
  assert.deepEqual(collectUncovered(grid, [treasure]), []);
  grid.set(10, 11, 10, EMPTY);
  assert.deepEqual(collectUncovered(grid, [treasure]), [treasure]);
  assert.deepEqual(collectUncovered(grid, [treasure]), []);
});

test('a hammer hit on the treasure finds it', () => {
  const grid = createBlock();
  const treasure = { id: 'coin', x: 16, y: 16, z: 29, found: false };
  applyHit(grid, 'hammer', 16, 16, 31);
  assert.equal(collectUncovered(grid, [treasure]).length, 1);
});

test('nearestOpening finds the air near a shallow treasure only', () => {
  const grid = createBlock();
  // The block is full, so there is no air near the treasure.
  assert.equal(nearestOpening(grid, { x: 5, y: 5, z: 29 }, 3), null);
  grid.set(5, 5, 31, EMPTY);
  assert.deepEqual(nearestOpening(grid, { x: 5, y: 5, z: 29 }, 3), [5, 5, 31]);
  assert.equal(nearestOpening(grid, { x: 16, y: 16, z: 16 }, 3), null);
});

test('rare treasures come less often than common treasures', () => {
  const rand = makeRandom(7);
  const counts = { common: 0, rare: 0, super: 0 };
  const rarity = Object.fromEntries(TREASURES.map((t) => [t.id, t.rarity]));
  for (let k = 0; k < 5000; k++) counts[rarity[pickTreasure(rand)]]++;
  assert.ok(counts.common > counts.rare);
  assert.ok(counts.rare > counts.super);
  assert.ok(counts.super > 0);
});

test('the collection counts the treasures', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadCollection(storage), {});
  assert.deepEqual(addToCollection(storage, 'gem'), { isNew: true, count: 1 });
  assert.deepEqual(addToCollection(storage, 'gem'), { isNew: false, count: 2 });
  addToCollection(storage, 'sock');
  assert.deepEqual(loadCollection(storage), { gem: 2, sock: 1 });
  assert.throws(() => addToCollection(storage, 'banana'));
});

test('bad collection data gives an empty collection', () => {
  const storage = memoryStorage();
  storage.setItem(COLLECTION_KEY, 'not json');
  assert.deepEqual(loadCollection(storage), {});
  storage.setItem(COLLECTION_KEY, '{"gem": -3, "banana": 2, "coin": 1.5, "key": 4}');
  assert.deepEqual(loadCollection(storage), { key: 4 });
});
