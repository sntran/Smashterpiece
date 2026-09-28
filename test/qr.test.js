import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQr, byteCapacity, dataCodewords } from '../src/core/qr.js';

test('the capacities agree with the QR code standard', () => {
  assert.equal(byteCapacity(1, 'M'), 14);
  assert.equal(byteCapacity(1, 'L'), 17);
  assert.equal(byteCapacity(10, 'M'), 213);
  assert.equal(dataCodewords(25, 'L'), 1276);
  assert.equal(byteCapacity(40, 'M'), 2331);
  assert.equal(byteCapacity(40, 'L'), 2953);
});

test('the smallest version holds the data', () => {
  assert.equal(makeQr('x'.repeat(14)).version, 1);
  assert.equal(makeQr('x'.repeat(15)).version, 2);
  const big = makeQr('x'.repeat(2400));
  assert.equal(big.level, 'L');
  assert.equal(makeQr('x'.repeat(2954)), null);
  assert.equal(makeQr('x'.repeat(400), { maxVersion: 10 }), null);
});

function finderAt(qr, x0, y0) {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (qr.dark(x0 + dx, y0 + dy) !== (ring !== 2)) return false;
    }
  }
  return true;
}

for (const n of [10, 120, 700]) {
  test(`a QR code with ${n} bytes has the fixed patterns`, () => {
    const qr = makeQr('a'.repeat(n));
    const s = qr.size;
    assert.equal(s, qr.version * 4 + 17);
    assert.ok(finderAt(qr, 0, 0));
    assert.ok(finderAt(qr, s - 7, 0));
    assert.ok(finderAt(qr, 0, s - 7));
    // The timing patterns change color at each module.
    for (let i = 8; i < s - 8; i++) {
      assert.equal(qr.dark(i, 6), i % 2 === 0);
      assert.equal(qr.dark(6, i), i % 2 === 0);
    }
    // The dark module.
    assert.equal(qr.dark(8, s - 8), true);
    // The two copies of the format information are the same.
    const first = [];
    for (let i = 0; i <= 5; i++) first.push(qr.dark(8, i));
    first.push(qr.dark(8, 7), qr.dark(8, 8), qr.dark(7, 8));
    for (let i = 9; i < 15; i++) first.push(qr.dark(14 - i, 8));
    const second = [];
    for (let i = 0; i < 8; i++) second.push(qr.dark(s - 1 - i, 8));
    for (let i = 8; i < 15; i++) second.push(qr.dark(8, s - 15 + i));
    assert.deepEqual(first, second);
  });
}
