import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock } from '../src/core/grid.js';
import { applyHit } from '../src/core/carve.js';
import {
  rleEncode, rleDecode, toBase64, fromBase64, encodeStatue, decodeStatue,
  loadMuseum, addStatue, removeStatue, MUSEUM_KEY, MUSEUM_LIMIT,
} from '../src/core/codec.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    data,
  };
}

test('run-length coding gives the same bytes back', () => {
  const samples = [
    new Uint8Array(0),
    Uint8Array.from([7]),
    Uint8Array.from([1, 1, 1, 2, 2, 255, 0, 0, 0, 0]),
    new Uint8Array(40000).fill(3),
  ];
  for (const bytes of samples) {
    assert.deepEqual(rleDecode(rleEncode(bytes), bytes.length), bytes);
  }
});

test('run-length coding makes a block small', () => {
  const grid = createBlock({ hardness: 2 });
  const packed = rleEncode(grid.cells);
  assert.ok(packed.length < 200, `size is ${packed.length}`);
});

test('base64 gives the same bytes back', () => {
  for (let n = 0; n < 12; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  }
  assert.equal(toBase64(Uint8Array.from([77, 97, 110])), 'TWFu');
  assert.equal(toBase64(Uint8Array.from([77])), 'TQ==');
  assert.throws(() => fromBase64('a*b'));
});

test('a carved statue gives the same cells back', () => {
  const grid = createBlock({ hardness: 3 });
  applyHit(grid, 'hammer', 10, 20, 31);
  applyHit(grid, 'chisel', 3, 3, 3);
  applyHit(grid, 'file', 0, 31, 0);
  const record = encodeStatue({ id: 'a', size: 32, cells: grid.cells, stone: 'granite', shape: 'fish', stars: 2, created: 5 });
  const text = JSON.stringify(record);
  assert.ok(text.length < 4000, `size is ${text.length}`);
  const statue = decodeStatue(JSON.parse(text));
  assert.deepEqual(statue.cells, grid.cells);
  assert.equal(statue.stone, 'granite');
  assert.equal(statue.shape, 'fish');
  assert.equal(statue.stars, 2);
});

test('decodeStatue rejects bad records', () => {
  assert.throws(() => decodeStatue(null));
  assert.throws(() => decodeStatue({ v: 99, size: 32, data: '' }));
  assert.throws(() => decodeStatue({ v: 1, size: 4, data: toBase64(rleEncode(new Uint8Array(10))) }));
  assert.throws(() => decodeStatue({ v: 1, size: 4, data: 'AQ' }));
});

test('the Museum adds, loads and removes statues', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadMuseum(storage), []);
  const cells = createBlock({ size: 4 }).cells;
  const a = addStatue(storage, { size: 4, cells, stone: 'marble' });
  const b = addStatue(storage, { size: 4, cells, stone: 'sandstone' });
  assert.notEqual(a.id, b.id);
  assert.equal(loadMuseum(storage).length, 2);
  assert.equal(removeStatue(storage, a.id), true);
  assert.equal(removeStatue(storage, 'nothing'), false);
  const rest = loadMuseum(storage);
  assert.equal(rest.length, 1);
  assert.equal(rest[0].id, b.id);
  assert.deepEqual(decodeStatue(rest[0]).cells, cells);
});

test('the Museum forgets the oldest statue when it is full', () => {
  const storage = memoryStorage();
  const cells = createBlock({ size: 2 }).cells;
  for (let i = 0; i < MUSEUM_LIMIT + 3; i++) addStatue(storage, { id: `s${i}`, size: 2, cells, stone: 'marble' });
  const list = loadMuseum(storage);
  assert.equal(list.length, MUSEUM_LIMIT);
  assert.equal(list[0].id, 's3');
});

test('bad Museum data gives an empty list', () => {
  const storage = memoryStorage();
  storage.setItem(MUSEUM_KEY, '{not json');
  assert.deepEqual(loadMuseum(storage), []);
  storage.setItem(MUSEUM_KEY, '{"a":1}');
  assert.deepEqual(loadMuseum(storage), []);
});
