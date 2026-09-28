// Badges for things that the player does. This module does not use
// three.js or the DOM.
//
// The game keeps a few numbers (the stats). A badge is earned when its
// check is true for the stats.

import { STONE_NAMES } from './stones.js';
import { PICTURE_SHAPES } from './shapes.js';
import { TREASURES } from './treasures.js';

export const STATS_KEY = 'smashterpiece.stats';

export const BADGES = [
  { id: 'first-smash', check: (s) => s.hits >= 1 },
  { id: 'hundred-hits', check: (s) => s.hits >= 100 },
  { id: 'big-crash', check: (s) => s.biggestPiece >= 200 },
  { id: 'explorer', check: (s) => STONE_NAMES.every((n) => s.materials.includes(n)) },
  { id: 'star-sculptor', check: (s) => s.threeStars.length >= 1 },
  { id: 'shape-champion', check: (s) => PICTURE_SHAPES.every((n) => s.threeStars.includes(n)) },
  { id: 'letter-carver', check: (s) => s.letters.length >= 1 },
  { id: 'museum-builder', check: (s) => s.saved >= 5 },
  { id: 'painter', check: (s) => s.painted >= 100 },
  { id: 'silly-face', check: (s) => s.eyes >= 2 },
  { id: 'sharer', check: (s) => s.shared >= 1 },
  { id: 'treasure-hunter', check: (s) => s.treasureKinds >= 5 },
  { id: 'treasure-master', check: (s) => s.treasureKinds >= TREASURES.length },
];

export const BADGE_IDS = BADGES.map((b) => b.id);

export function emptyStats() {
  return {
    hits: 0,
    biggestPiece: 0,
    materials: [],
    threeStars: [],
    letters: [],
    saved: 0,
    painted: 0,
    eyes: 0,
    shared: 0,
    treasureKinds: 0,
  };
}

const addOnce = (list, value) => (list.includes(value) ? list : [...list, value]);

// Return new stats after an event. The old stats do not change.
//   hit       { stone }      a hit that changed the stone
//   piece     { size }       a piece fell
//   finish    { shape, stars }
//   save                     a statue went to the Museum
//   paint     { count }      voxels got paint
//   sticker   { type }
//   share                    a statue link was made
//   treasures { kinds }      the number of kinds in the collection
export function recordEvent(stats, name, data = {}) {
  const s = { ...stats };
  switch (name) {
    case 'hit':
      s.hits += 1;
      if (data.stone) s.materials = addOnce(s.materials, data.stone);
      break;
    case 'piece':
      s.biggestPiece = Math.max(s.biggestPiece, data.size ?? 0);
      break;
    case 'finish':
      if (data.shape?.startsWith('letter-')) s.letters = addOnce(s.letters, data.shape);
      else if (data.stars >= 3 && data.shape) s.threeStars = addOnce(s.threeStars, data.shape);
      break;
    case 'save':
      s.saved += 1;
      break;
    case 'paint':
      s.painted += data.count ?? 0;
      break;
    case 'sticker':
      if (data.type === 'eye') s.eyes += 1;
      break;
    case 'share':
      s.shared += 1;
      break;
    case 'treasures':
      s.treasureKinds = Math.max(s.treasureKinds, data.kinds ?? 0);
      break;
    default:
      throw new Error(`Unknown event: ${name}`);
  }
  return s;
}

export function earnedBadges(stats) {
  return BADGES.filter((b) => b.check(stats)).map((b) => b.id);
}

// Return the badges that the new stats earn and the old stats do not.
export function newBadges(before, after) {
  const old = new Set(earnedBadges(before));
  return earnedBadges(after).filter((id) => !old.has(id));
}

export function loadStats(storage) {
  const stats = emptyStats();
  try {
    const data = JSON.parse(storage.getItem(STATS_KEY) || '{}');
    if (!data || typeof data !== 'object') return stats;
    for (const key of Object.keys(stats)) {
      const value = data[key];
      if (Array.isArray(stats[key])) {
        if (Array.isArray(value)) stats[key] = value.filter((v) => typeof v === 'string');
      } else if (Number.isFinite(value) && value >= 0) {
        stats[key] = value;
      }
    }
  } catch {
    // Bad data gives empty stats.
  }
  return stats;
}

export function saveStats(storage, stats) {
  storage.setItem(STATS_KEY, JSON.stringify(stats));
}
