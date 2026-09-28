// Save and load the game. This module does not use three.js or the DOM.
//
// 1. The game in progress: the game saves the current block after each
//    hit, so that the player can continue later.
// 2. The backup file: one file with all the data of the game (the Museum,
//    the treasures and the game in progress). A parent can keep the file,
//    or move it to a different device and load it there.
//
// All functions use a storage object with getItem and setItem, for
// example window.localStorage.

import {
  rleEncode, rleDecode, toBase64, fromBase64, loadMuseum, saveMuseum, decodeStatue, MUSEUM_LIMIT,
  encodePaint, decodePaint, cleanStickers, isReplayData,
} from './codec.js';
import { loadCollection, COLLECTION_KEY, TREASURE_IDS } from './treasures.js';
import { STONES } from './stones.js';
import { SHAPE_NAMES } from './shapes.js';

export const PROGRESS_KEY = 'smashterpiece.current';
export const PROGRESS_VERSION = 1;
// The number of undo steps that the saved game keeps.
export const SAVED_UNDO_STEPS = 10;

function encodeStep({ cells, paint = null, stickers = [] }, size) {
  const step = { data: toBase64(rleEncode(cells)) };
  const painted = encodePaint(cells, paint);
  if (painted) step.paint = painted;
  if (stickers.length) step.stickers = cleanStickers(stickers, size);
  return step;
}

function decodeStep(step, size) {
  const cells = rleDecode(fromBase64(String(step.data)), size * size * size);
  return { cells, paint: decodePaint(step.paint, cells.length), stickers: cleanStickers(step.stickers, size) };
}
export const BACKUP_APP = 'smashterpiece';
export const BACKUP_VERSION = 1;

// Change the game in progress into a record that JSON can keep.
export function encodeProgress(state) {
  const { mode, stone, shape = null, size, cells, treasures = [], outsideStart = 0, finished = false, saved = 0 } = state;
  if (cells.length !== size * size * size) throw new Error('The cell data does not agree with the size.');
  const record = {
    v: PROGRESS_VERSION,
    mode,
    stone,
    shape,
    size,
    outsideStart,
    finished,
    saved,
    treasures: treasures.map(({ id, x, y, z, found }) => ({ id, x, y, z, found: !!found })),
    data: toBase64(rleEncode(cells)),
  };
  const painted = encodePaint(cells, state.paint);
  if (painted) record.paint = painted;
  if (state.stickers && state.stickers.length) record.stickers = cleanStickers(state.stickers, size);
  if (state.undo && state.undo.length) record.undo = state.undo.slice(-SAVED_UNDO_STEPS).map((s) => encodeStep(s, size));
  if (isReplayData(state.replay)) record.replay = { start: state.replay.start, steps: state.replay.steps };
  return record;
}

// Change a record back into the game in progress. Throw an error when
// the record is bad.
export function decodeProgress(record) {
  if (!record || record.v !== PROGRESS_VERSION) throw new Error('The saved game version is not correct.');
  const { mode, stone, shape, size } = record;
  if (mode !== 'free' && mode !== 'challenge') throw new Error('The saved game mode is not correct.');
  if (!STONES[stone]) throw new Error('The saved stone is not correct.');
  if (mode === 'challenge' && !SHAPE_NAMES.includes(shape)) throw new Error('The saved shape is not correct.');
  if (!Number.isInteger(size) || size < 1 || size > 128) throw new Error('The saved size is not correct.');
  const cells = rleDecode(fromBase64(String(record.data)), size * size * size);
  const treasures = Array.isArray(record.treasures) ? record.treasures : [];
  for (const t of treasures) {
    const inside = [t.x, t.y, t.z].every((v) => Number.isInteger(v) && v >= 0 && v < size);
    if (!TREASURE_IDS.includes(t.id) || !inside) throw new Error('A saved treasure is not correct.');
  }
  return {
    mode,
    stone,
    shape: mode === 'challenge' ? shape : null,
    size,
    cells,
    outsideStart: Number(record.outsideStart) || 0,
    finished: !!record.finished,
    saved: Number(record.saved) || 0,
    treasures: treasures.map(({ id, x, y, z, found }) => ({ id, x, y, z, found: !!found })),
    paint: decodePaint(record.paint, cells.length),
    stickers: cleanStickers(record.stickers, size),
    undo: Array.isArray(record.undo) ? record.undo.map((s) => decodeStep(s, size)) : [],
    replay: isReplayData(record.replay) ? record.replay : null,
  };
}

export function saveProgress(storage, state) {
  storage.setItem(PROGRESS_KEY, JSON.stringify(encodeProgress(state)));
}

// Return the game in progress, or null when there is no good saved game.
export function loadProgress(storage) {
  try {
    const text = storage.getItem(PROGRESS_KEY);
    return text ? decodeProgress(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function clearProgress(storage) {
  if (typeof storage.removeItem === 'function') storage.removeItem(PROGRESS_KEY);
  else storage.setItem(PROGRESS_KEY, '');
}

// Make the backup object with all the data of the game.
export function makeBackup(storage, now = Date.now()) {
  let progress = null;
  try {
    const text = storage.getItem(PROGRESS_KEY);
    progress = text ? JSON.parse(text) : null;
  } catch {
    progress = null;
  }
  return {
    app: BACKUP_APP,
    v: BACKUP_VERSION,
    created: now,
    museum: loadMuseum(storage),
    treasures: loadCollection(storage),
    progress,
  };
}

// Read the text of a backup file. Throw an error when it is not a backup
// of this game. Bad statues and bad treasures are not in the result.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The file is not a backup of the game.');
  }
  if (!data || data.app !== BACKUP_APP) throw new Error('The file is not a backup of the game.');
  if (data.v !== BACKUP_VERSION) throw new Error('The backup version is not correct.');
  const museum = (Array.isArray(data.museum) ? data.museum : []).filter((record) => {
    try {
      decodeStatue(record);
      return typeof record.id === 'string' && record.id.length > 0;
    } catch {
      return false;
    }
  });
  const treasures = {};
  if (data.treasures && typeof data.treasures === 'object') {
    for (const id of TREASURE_IDS) {
      const count = Number(data.treasures[id]);
      if (Number.isInteger(count) && count > 0) treasures[id] = count;
    }
  }
  let progress = null;
  try {
    if (data.progress) {
      decodeProgress(data.progress);
      progress = data.progress;
    }
  } catch {
    progress = null;
  }
  return { created: Number(data.created) || 0, museum, treasures, progress };
}

// Add the data of a backup to the data on this device. Nothing on this
// device is lost:
//   - The Museum gets the statues that it does not have yet. When it is
//     too full, the oldest statues go.
//   - Each treasure count becomes the larger of the two counts.
//   - The game in progress comes from the backup only when this device
//     has no game in progress.
// Return what changed.
export function mergeBackup(storage, backup) {
  const museum = loadMuseum(storage);
  const known = new Set(museum.map((r) => r.id));
  const added = backup.museum.filter((r) => !known.has(r.id));
  const all = [...museum, ...added].sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  while (all.length > MUSEUM_LIMIT) all.shift();
  saveMuseum(storage, all);

  const collection = loadCollection(storage);
  let newKinds = 0;
  for (const [id, count] of Object.entries(backup.treasures)) {
    if (!collection[id]) newKinds++;
    collection[id] = Math.max(collection[id] ?? 0, count);
  }
  storage.setItem(COLLECTION_KEY, JSON.stringify(collection));

  let progress = false;
  if (backup.progress && !loadProgress(storage)) {
    storage.setItem(PROGRESS_KEY, JSON.stringify(backup.progress));
    progress = true;
  }
  return { statues: added.length, treasures: newKinds, progress };
}
