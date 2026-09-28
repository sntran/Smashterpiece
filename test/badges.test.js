import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STONE_NAMES } from '../src/core/stones.js';
import { PICTURE_SHAPES } from '../src/core/shapes.js';
import { TREASURES } from '../src/core/treasures.js';
import {
  BADGES, BADGE_IDS, emptyStats, recordEvent, earnedBadges, newBadges, loadStats, saveStats, STATS_KEY, keepBadges,
} from '../src/core/badges.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('each badge has a unique id', () => {
  assert.equal(new Set(BADGE_IDS).size, BADGES.length);
});

test('empty stats earn no badges', () => {
  assert.deepEqual(earnedBadges(emptyStats()), []);
});

test('the first hit earns the first badge', () => {
  const before = emptyStats();
  const after = recordEvent(before, 'hit', { stone: 'sand' });
  assert.deepEqual(newBadges(before, after), ['first-smash']);
  assert.equal(before.hits, 0);
});

test('all materials earn the explorer badge', () => {
  let s = emptyStats();
  for (const stone of STONE_NAMES) s = recordEvent(s, 'hit', { stone });
  s = recordEvent(s, 'hit', { stone: 'sand' });
  assert.equal(s.materials.length, STONE_NAMES.length);
  assert.ok(earnedBadges(s).includes('explorer'));
});

test('3 stars on every picture shape earn the champion badge', () => {
  let s = emptyStats();
  for (const shape of PICTURE_SHAPES.slice(1)) s = recordEvent(s, 'finish', { shape, stars: 3 });
  s = recordEvent(s, 'finish', { shape: PICTURE_SHAPES[0], stars: 2 });
  assert.ok(!earnedBadges(s).includes('shape-champion'));
  const after = recordEvent(s, 'finish', { shape: PICTURE_SHAPES[0], stars: 3 });
  assert.deepEqual(newBadges(s, after), ['shape-champion']);
});

test('the other events earn their badges', () => {
  let s = emptyStats();
  s = recordEvent(s, 'piece', { size: 250 });
  s = recordEvent(s, 'finish', { shape: 'letter-A', stars: 1 });
  for (let k = 0; k < 5; k++) s = recordEvent(s, 'save');
  s = recordEvent(s, 'paint', { count: 120 });
  s = recordEvent(s, 'sticker', { type: 'eye' });
  s = recordEvent(s, 'sticker', { type: 'eye' });
  s = recordEvent(s, 'share');
  s = recordEvent(s, 'treasures', { kinds: 18 });
  const earned = earnedBadges(s);
  for (const id of ['big-crash', 'letter-carver', 'museum-builder', 'painter', 'silly-face', 'sharer', 'treasure-hunter', 'treasure-master']) {
    assert.ok(earned.includes(id), id);
  }
  assert.throws(() => recordEvent(s, 'dance'));
});

test('the stats are saved and bad data is removed', () => {
  const storage = memoryStorage();
  const s = recordEvent(emptyStats(), 'hit', { stone: 'ice' });
  saveStats(storage, s);
  assert.deepEqual(loadStats(storage), s);
  storage.setItem(STATS_KEY, '{"hits": -5, "materials": [1, "wood"], "painted": "a lot"}');
  const clean = loadStats(storage);
  assert.equal(clean.hits, 0);
  assert.deepEqual(clean.materials, ['wood']);
  assert.equal(clean.painted, 0);
  storage.setItem(STATS_KEY, 'not json');
  assert.deepEqual(loadStats(storage), emptyStats());
});

test('a badge stays when its check becomes harder', () => {
  let s = recordEvent(emptyStats(), 'treasures', { kinds: 18 });
  assert.ok(earnedBadges(s).includes('treasure-master'));
  assert.ok(!earnedBadges(s).includes('treasure-legend'));
  s = keepBadges(s);
  // A later version needs more: the kept badge stays.
  const harder = { ...s, treasureKinds: 0 };
  assert.ok(earnedBadges(harder).includes('treasure-master'));
  const storage = memoryStorage();
  saveStats(storage, s);
  assert.deepEqual(loadStats(storage).kept, s.kept);
});

test('all the treasures earn the legend badge', () => {
  const s = recordEvent(emptyStats(), 'treasures', { kinds: TREASURES.length });
  assert.ok(earnedBadges(s).includes('treasure-legend'));
});
