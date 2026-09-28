import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, PEDESTAL, EMPTY } from '../src/core/grid.js';
import { applyHit } from '../src/core/carve.js';
import { buildGhost } from '../src/core/shapes.js';
import {
  encodeShare, decodeShare, toBase64Url, fromBase64Url, deflate, shareTextFrom, shareId, SHARE_PREFIX,
} from '../src/core/share.js';

function heartStatue() {
  const ghost = buildGhost('heart');
  const grid = createBlock({ box: ghost.box, hardness: 2 });
  for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] !== PEDESTAL && !ghost.mask[i]) grid.cells[i] = EMPTY;
  return { size: 32, cells: grid.cells, stone: 'marble', shape: 'heart', stars: 3 };
}

test('a shared statue gives the same statue back', async () => {
  const statue = heartStatue();
  const text = await encodeShare(statue);
  assert.match(text, /^[A-Za-z0-9_-]+$/);
  const back = await decodeShare(text);
  assert.deepEqual(back.cells, statue.cells);
  assert.equal(back.stone, 'marble');
  assert.equal(back.shape, 'heart');
  assert.equal(back.stars, 3);
});

test('a neat statue makes a short link', async () => {
  const text = await encodeShare(heartStatue());
  assert.ok(text.length < 300, `the link text has ${text.length} characters`);
});

test('the link does not keep cracks', async () => {
  const grid = createBlock({ size: 8, hardness: 3 });
  applyHit(grid, 'chisel', 4, 4, 4);
  const back = await decodeShare(await encodeShare({ size: 8, cells: grid.cells, stone: 'granite' }));
  assert.equal(back.shape, null);
  assert.equal(back.stars, 0);
  for (let i = 0; i < grid.cells.length; i++) {
    const v = grid.cells[i];
    assert.equal(back.cells[i], v === EMPTY ? EMPTY : v === PEDESTAL ? PEDESTAL : 3);
  }
});

test('bad links give an error', async () => {
  await assert.rejects(decodeShare('not*base64'));
  await assert.rejects(decodeShare('AAAA'));
  await assert.rejects(decodeShare(toBase64Url(await deflate(Uint8Array.from([9, 0, 255, 0, 2])))));
  // The header says size 4, but there is only one byte of cells (4 x 4 x 3 bits need 6 bytes).
  await assert.rejects(decodeShare(toBase64Url(await deflate(Uint8Array.from([1, 0, 255, 0, 4, 1])))));
  // An unknown stone.
  await assert.rejects(decodeShare(toBase64Url(await deflate(Uint8Array.from([1, 99, 255, 0, 2, 1])))));
});

test('a very large statue is rejected before it fills the memory', async () => {
  const header = Uint8Array.from([1, 0, 255, 0, 200]);
  const huge = new Uint8Array(header.length + Math.ceil((200 * 200 * 199) / 8));
  huge.set(header);
  await assert.rejects(decodeShare(toBase64Url(await deflate(huge))));
});

test('base64url round trip', () => {
  for (let n = 0; n < 10; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 251 + 7) & 255);
    assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
  }
});

test('the fragment gives the share text', () => {
  assert.equal(shareTextFrom(`${SHARE_PREFIX}abc`), 'abc');
  assert.equal(shareTextFrom('#other'), null);
  assert.equal(shareTextFrom(''), null);
});

test('the same link gives the same id', () => {
  assert.equal(shareId('abc'), shareId('abc'));
  assert.notEqual(shareId('abc'), shareId('abd'));
});
