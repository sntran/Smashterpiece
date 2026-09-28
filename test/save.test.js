import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock } from '../src/core/grid.js';
import { applyHit } from '../src/core/carve.js';
import { addStatue, loadMuseum, MUSEUM_LIMIT } from '../src/core/codec.js';
import { addToCollection, loadCollection } from '../src/core/treasures.js';
import {
  encodeProgress, decodeProgress, saveProgress, loadProgress, clearProgress,
  makeBackup, parseBackup, mergeBackup, PROGRESS_KEY,
} from '../src/core/save.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function carvedGame() {
  const grid = createBlock({ hardness: 2 });
  applyHit(grid, 'hammer', 16, 20, 31);
  applyHit(grid, 'chisel', 5, 5, 31);
  return {
    mode: 'challenge',
    stone: 'marble',
    shape: 'fish',
    size: 32,
    cells: grid.cells,
    outsideStart: 1234,
    finished: false,
    saved: 99,
    treasures: [{ id: 'gem', x: 3, y: 4, z: 5, found: false }, { id: 'sock', x: 9, y: 9, z: 9, found: true }],
  };
}

test('the game in progress gives the same state back', () => {
  const game = carvedGame();
  const state = decodeProgress(JSON.parse(JSON.stringify(encodeProgress(game))));
  assert.deepEqual(state.cells, game.cells);
  assert.deepEqual(state.treasures, game.treasures);
  assert.equal(state.stone, 'marble');
  assert.equal(state.shape, 'fish');
  assert.equal(state.outsideStart, 1234);
});

test('saveProgress, loadProgress and clearProgress work together', () => {
  const storage = memoryStorage();
  assert.equal(loadProgress(storage), null);
  saveProgress(storage, carvedGame());
  assert.equal(loadProgress(storage).mode, 'challenge');
  clearProgress(storage);
  assert.equal(loadProgress(storage), null);
});

test('a bad game in progress gives null', () => {
  const storage = memoryStorage();
  storage.setItem(PROGRESS_KEY, '{bad');
  assert.equal(loadProgress(storage), null);
  const record = encodeProgress(carvedGame());
  for (const change of [{ stone: 'lava' }, { mode: 'race' }, { shape: 'lion' }, { treasures: [{ id: 'gem', x: 99, y: 0, z: 0 }] }]) {
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...record, ...change }));
    assert.equal(loadProgress(storage), null, JSON.stringify(change));
  }
});

test('a backup moves all data to a new device', () => {
  const phone = memoryStorage();
  const cells = createBlock({ size: 4 }).cells;
  addStatue(phone, { id: 'a', size: 4, cells, stone: 'wood', created: 1 });
  addToCollection(phone, 'gem');
  addToCollection(phone, 'gem');
  saveProgress(phone, carvedGame());
  const text = JSON.stringify(makeBackup(phone, 5));

  const tablet = memoryStorage();
  const result = mergeBackup(tablet, parseBackup(text));
  assert.deepEqual(result, { statues: 1, treasures: 1, progress: true });
  assert.equal(loadMuseum(tablet)[0].id, 'a');
  assert.deepEqual(loadCollection(tablet), { gem: 2 });
  assert.deepEqual(loadProgress(tablet).cells, carvedGame().cells);
});

test('a backup does not remove data on the device', () => {
  const cells = createBlock({ size: 4 }).cells;
  const old = memoryStorage();
  addStatue(old, { id: 'a', size: 4, cells, stone: 'wood', created: 1 });
  addToCollection(old, 'sock');
  const backup = parseBackup(JSON.stringify(makeBackup(old)));

  const device = memoryStorage();
  addStatue(device, { id: 'b', size: 4, cells, stone: 'ice', created: 2 });
  addToCollection(device, 'sock');
  addToCollection(device, 'sock');
  addToCollection(device, 'crown');
  saveProgress(device, { ...carvedGame(), stone: 'granite' });

  const result = mergeBackup(device, backup);
  assert.deepEqual(result, { statues: 1, treasures: 0, progress: false });
  assert.deepEqual(loadMuseum(device).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(loadCollection(device), { sock: 2, crown: 1 });
  assert.equal(loadProgress(device).stone, 'granite');
  // The same backup a second time adds nothing.
  assert.deepEqual(mergeBackup(device, backup), { statues: 0, treasures: 0, progress: false });
});

test('the merged Museum keeps the newest statues when it is full', () => {
  const cells = createBlock({ size: 2 }).cells;
  const a = memoryStorage();
  const b = memoryStorage();
  for (let i = 0; i < MUSEUM_LIMIT; i++) {
    addStatue(a, { id: `a${i}`, size: 2, cells, stone: 'sand', created: i * 2 });
    addStatue(b, { id: `b${i}`, size: 2, cells, stone: 'sand', created: i * 2 + 1 });
  }
  mergeBackup(a, parseBackup(JSON.stringify(makeBackup(b))));
  const ids = loadMuseum(a).map((r) => r.id);
  assert.equal(ids.length, MUSEUM_LIMIT);
  assert.ok(ids.includes(`b${MUSEUM_LIMIT - 1}`));
  assert.ok(!ids.includes('a0'));
});

test('parseBackup rejects other files and removes bad parts', () => {
  assert.throws(() => parseBackup('hello'));
  assert.throws(() => parseBackup('{"app":"other","v":1}'));
  assert.throws(() => parseBackup('{"app":"smashterpiece","v":7}'));
  const backup = parseBackup(JSON.stringify({
    app: 'smashterpiece',
    v: 1,
    museum: [{ v: 1, id: 'x', size: 2, data: 'bad' }],
    treasures: { gem: 2, banana: 5, key: -1 },
    progress: { v: 1, mode: 'free', stone: 'lava' },
  }));
  assert.deepEqual(backup.museum, []);
  assert.deepEqual(backup.treasures, { gem: 2 });
  assert.equal(backup.progress, null);
});
