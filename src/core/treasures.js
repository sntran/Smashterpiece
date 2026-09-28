// Hidden treasures. This module does not use three.js or the DOM.
//
// When a new block starts, the game hides a few treasures in the stone.
// A treasure is found when the player removes its voxel or a voxel next
// to it, so that the treasure can see the air.

import { EMPTY, PEDESTAL } from './grid.js';

export const RARITY_WEIGHT = { common: 6, rare: 3, super: 1 };

export const TREASURES = [
  { id: 'coin', rarity: 'common' },
  { id: 'shell', rarity: 'common' },
  { id: 'bone', rarity: 'common' },
  { id: 'key', rarity: 'common' },
  { id: 'sock', rarity: 'common' },
  { id: 'cookie', rarity: 'common' },
  { id: 'gem', rarity: 'rare' },
  { id: 'ring', rarity: 'rare' },
  { id: 'dino', rarity: 'rare' },
  { id: 'trophy', rarity: 'rare' },
  { id: 'pizza', rarity: 'rare' },
  { id: 'robot', rarity: 'rare' },
  { id: 'crown', rarity: 'super' },
  { id: 'unicorn', rarity: 'super' },
  { id: 'rainbow', rarity: 'super' },
  { id: 'alien', rarity: 'super' },
  { id: 'dragon', rarity: 'super' },
  { id: 'ufo', rarity: 'super' },
];

export const TREASURE_IDS = TREASURES.map((t) => t.id);

const FACE_STEPS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

// Select a treasure. Rare treasures come less often. A treasure that is
// not in the collection yet comes two times as often.
export function pickTreasure(rand, collected = {}) {
  const weights = TREASURES.map((t) => RARITY_WEIGHT[t.rarity] * (collected[t.id] ? 1 : 2));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let k = 0; k < TREASURES.length; k++) {
    r -= weights[k];
    if (r < 0) return TREASURES[k].id;
  }
  return TREASURES[TREASURES.length - 1].id;
}

// Return true when the cell and all its face neighbors are stone.
function isBuried(grid, x, y, z) {
  const v = grid.get(x, y, z);
  if (v === EMPTY || v === PEDESTAL) return false;
  for (const [dx, dy, dz] of FACE_STEPS) {
    if (!grid.isSolid(x + dx, y + dy, z + dz)) return false;
  }
  return true;
}

// Hide `count` treasures in the stone. A treasure is never on the
// surface, never in `avoidMask` (for example the ghost shape), and never
// near another treasure. Return a list of { id, x, y, z, found }.
export function placeTreasures(grid, { count, rand, avoidMask = null, collected = {}, spacing = 6 }) {
  const s = grid.size;
  const out = [];
  for (let attempt = 0; attempt < 2000 && out.length < count; attempt++) {
    const x = Math.floor(rand() * s);
    const y = 2 + Math.floor(rand() * (s - 2));
    const z = Math.floor(rand() * s);
    if (!isBuried(grid, x, y, z)) continue;
    if (avoidMask && avoidMask[grid.index(x, y, z)]) continue;
    const near = out.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) + Math.abs(t.z - z) < spacing);
    if (near) continue;
    out.push({ id: pickTreasure(rand, collected), x, y, z, found: false });
  }
  return out;
}

// Return true when the treasure can see the air.
export function isUncovered(grid, t) {
  if (!grid.isSolid(t.x, t.y, t.z)) return true;
  for (const [dx, dy, dz] of FACE_STEPS) {
    if (!grid.isSolid(t.x + dx, t.y + dy, t.z + dz)) return true;
  }
  return false;
}

// Mark the treasures that the player uncovered. Return the new finds.
export function collectUncovered(grid, treasures) {
  const found = [];
  for (const t of treasures) {
    if (!t.found && isUncovered(grid, t)) {
      t.found = true;
      found.push(t);
    }
  }
  return found;
}

// Find an empty cell that is at most `maxSteps` face steps from the
// treasure. The game shows a small sparkle there as a hint.
// Return [x, y, z] or null.
export function nearestOpening(grid, t, maxSteps = 3) {
  const seen = new Set([grid.index(t.x, t.y, t.z)]);
  let layer = [[t.x, t.y, t.z]];
  for (let step = 0; step < maxSteps; step++) {
    const next = [];
    for (const [x, y, z] of layer) {
      for (const [dx, dy, dz] of FACE_STEPS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (!grid.inside(nx, ny, nz)) continue;
        const i = grid.index(nx, ny, nz);
        if (seen.has(i)) continue;
        seen.add(i);
        if (grid.cells[i] === EMPTY) return [nx, ny, nz];
        next.push([nx, ny, nz]);
      }
    }
    layer = next;
  }
  return null;
}

// The collection keeps the number of times that the player found each
// treasure. It uses a storage object with getItem and setItem.
export const COLLECTION_KEY = 'smashterpiece.treasures';

export function loadCollection(storage) {
  try {
    const data = JSON.parse(storage.getItem(COLLECTION_KEY) || '{}');
    const out = {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
    for (const id of TREASURE_IDS) {
      const count = Number(data[id]);
      if (Number.isInteger(count) && count > 0) out[id] = count;
    }
    return out;
  } catch {
    return {};
  }
}

// Add one treasure to the collection. Return { isNew, count }.
export function addToCollection(storage, id) {
  if (!TREASURE_IDS.includes(id)) throw new Error(`Unknown treasure: ${id}`);
  const data = loadCollection(storage);
  const count = (data[id] ?? 0) + 1;
  data[id] = count;
  storage.setItem(COLLECTION_KEY, JSON.stringify(data));
  return { isNew: count === 1, count };
}
