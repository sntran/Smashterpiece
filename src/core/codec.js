// Save and load. This module compresses the voxel data and keeps the
// statues of the Museum. It does not use three.js or the DOM.
//
// The compression is run-length coding: each run of equal cells becomes
// a length (as a variable-length number) and a value. Base64 then changes
// the bytes into text for localStorage.

export const FORMAT_VERSION = 1;
export const MUSEUM_KEY = 'smashterpiece.museum';
export const MUSEUM_LIMIT = 40;

export function rleEncode(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    const value = bytes[i];
    let run = 1;
    while (i + run < bytes.length && bytes[i + run] === value) run++;
    writeLength(out, run);
    out.push(value);
    i += run;
  }
  return Uint8Array.from(out);
}

export function rleDecode(data, length) {
  const out = new Uint8Array(length);
  let pos = 0;
  let i = 0;
  while (i < data.length) {
    let run = 0;
    let shift = 0;
    let byte;
    do {
      if (i >= data.length) throw new Error('The saved data is not complete.');
      byte = data[i++];
      run += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    if (i >= data.length) throw new Error('The saved data is not complete.');
    const value = data[i++];
    if (run === 0 || pos + run > length) throw new Error('The saved data is not correct.');
    out.fill(value, pos, pos + run);
    pos += run;
  }
  if (pos !== length) throw new Error('The saved data is not complete.');
  return out;
}

function writeLength(out, n) {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

export function fromBase64(text) {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let count = 0;
  let pos = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? LOOKUP[code] : -1;
    if (v < 0) throw new Error('The saved text is not correct.');
    bits = ((bits << 6) | v) & 0xffffff;
    count += 6;
    if (count >= 8) {
      count -= 8;
      out[pos++] = (bits >> count) & 0xff;
    }
  }
  return out.subarray(0, pos);
}

// Change a statue into a record that JSON can keep. The paint and the
// stickers are optional. A record without them is smaller.
export function encodeStatue({ id, size, cells, stone, shape = null, stars = 0, created = 0, paint = null, stickers = [] }) {
  if (cells.length !== size * size * size) throw new Error('The cell data does not agree with the size.');
  const record = {
    v: FORMAT_VERSION,
    id,
    size,
    stone,
    shape,
    stars,
    created,
    data: toBase64(rleEncode(cells)),
  };
  const painted = encodePaint(cells, paint);
  if (painted) record.paint = painted;
  if (stickers && stickers.length) record.stickers = cleanStickers(stickers, size);
  return record;
}

// Keep only the paint of stone voxels. Return null when there is no paint.
export function encodePaint(cells, paint) {
  if (!paint) return null;
  const kept = new Uint8Array(cells.length);
  let any = false;
  for (let i = 0; i < cells.length; i++) {
    if (paint[i] && cells[i] !== 0 && cells[i] !== 255) {
      kept[i] = paint[i];
      any = true;
    }
  }
  return any ? toBase64(rleEncode(kept)) : null;
}

export function decodePaint(text, length) {
  if (!text) return new Uint8Array(length);
  const paint = rleDecode(fromBase64(String(text)), length);
  if (paint.some((v) => v > 8)) throw new Error('The saved paint is not correct.');
  return paint;
}

const STICKER_NAMES = ['eye', 'glasses', 'hat', 'bow', 'flower', 'lips', 'star', 'crown'];

// Keep only good stickers, with only the known fields.
export function cleanStickers(list, size) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && STICKER_NAMES.includes(s.type) && Number.isInteger(s.face) && s.face >= 0 && s.face < 6 &&
      [s.x, s.y, s.z].every((v) => Number.isInteger(v) && v >= 0 && v < size))
    .slice(0, 60)
    .map(({ type, x, y, z, face }) => ({ type, x, y, z, face }));
}

// Change a record back into a statue. Throw an error when the record is bad.
export function decodeStatue(record) {
  if (!record || record.v !== FORMAT_VERSION) throw new Error('The statue version is not correct.');
  const size = record.size;
  if (!Number.isInteger(size) || size < 1 || size > 128) throw new Error('The statue size is not correct.');
  const cells = rleDecode(fromBase64(String(record.data)), size * size * size);
  return {
    id: record.id,
    size,
    cells,
    stone: record.stone,
    shape: record.shape ?? null,
    stars: record.stars ?? 0,
    created: record.created ?? 0,
    paint: decodePaint(record.paint, cells.length),
    stickers: cleanStickers(record.stickers, size),
  };
}

// The Museum functions use a storage object with getItem and setItem,
// for example window.localStorage.

// Return the list of records. Bad data gives an empty list.
export function loadMuseum(storage) {
  try {
    const text = storage.getItem(MUSEUM_KEY);
    if (!text) return [];
    const list = JSON.parse(text);
    return Array.isArray(list) ? list.filter((r) => r && r.v === FORMAT_VERSION) : [];
  } catch {
    return [];
  }
}

export function saveMuseum(storage, records) {
  storage.setItem(MUSEUM_KEY, JSON.stringify(records));
}

export function makeId(now = Date.now(), random = Math.random) {
  return `${now.toString(36)}-${Math.floor(random() * 1e9).toString(36)}`;
}

// Add a statue. When the Museum is full, remove the oldest statue.
// Return the new record. Throw an error when the storage is full.
export function addStatue(storage, statue) {
  const records = loadMuseum(storage);
  const record = encodeStatue({ ...statue, id: statue.id ?? makeId() });
  records.push(record);
  while (records.length > MUSEUM_LIMIT) records.shift();
  saveMuseum(storage, records);
  return record;
}

export function removeStatue(storage, id) {
  const records = loadMuseum(storage);
  const rest = records.filter((r) => r.id !== id);
  saveMuseum(storage, rest);
  return rest.length !== records.length;
}
