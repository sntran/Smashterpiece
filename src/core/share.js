// Share one statue in a link. This module does not use three.js or the DOM.
//
// The statue goes into the fragment of the link (the part after "#"). The
// browser does not send the fragment to the server, so the statue stays
// with the people who have the link.
//
// The data is a header and the voxels, compressed with deflate and written
// as base64url text:
//   byte 0  the format version
//   byte 1  the stone (index in STONE_NAMES)
//   byte 2  the shape (index in SHAPE_NAMES, 255 for no shape)
//   byte 3  the stars (0 to 3)
//   byte 4  the grid size
//   then    one bit for each cell above the pedestal layer (1 for stone),
//           in the order of the VoxelGrid index. The first cell is in
//           the lowest bit of the first byte.
// The pedestal layer is always full, so the link does not keep it. The
// link also does not keep the cracks: each stone voxel gets its full
// hardness again.

import { EMPTY, PEDESTAL } from './grid.js';
import { STONE_NAMES, hardnessOf } from './stones.js';
import { SHAPE_NAMES } from './shapes.js';
import { toBase64, fromBase64 } from './codec.js';

export const SHARE_VERSION = 1;
export const SHARE_PREFIX = '#s=';
const HEADER = 5;
const NO_SHAPE = 255;

// The number of bytes for one bit for each cell above the pedestal layer.
function bitBytes(size) {
  return Math.ceil((size * size * (size - 1)) / 8);
}

// Base64url uses "-" and "_" and no "=", so that the text is safe in a link.
export function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('The link is not correct.');
  return fromBase64(text.replace(/-/g, '+').replace(/_/g, '/'));
}

async function runStream(stream, bytes, limit) {
  const writer = stream.writable.getWriter();
  writer.write(bytes).catch(() => undefined);
  writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const parts = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    // Stop at once when the data is too large.
    if (length > limit) {
      reader.cancel().catch(() => undefined);
      throw new Error('The link is not correct.');
    }
    parts.push(value);
  }
  const out = new Uint8Array(length);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

export function deflate(bytes) {
  return runStream(new CompressionStream('deflate-raw'), bytes, Infinity);
}

export function inflate(bytes, limit) {
  return runStream(new DecompressionStream('deflate-raw'), bytes, limit);
}

// Make the text for the link. Return a promise.
export async function encodeShare({ size, cells, stone, shape = null, stars = 0 }) {
  const stoneIndex = STONE_NAMES.indexOf(stone);
  if (stoneIndex < 0) throw new Error(`Unknown stone: ${stone}`);
  if (cells.length !== size * size * size || size > 255) throw new Error('The cell data does not agree with the size.');
  const shapeIndex = shape ? SHAPE_NAMES.indexOf(shape) : NO_SHAPE;
  const raw = new Uint8Array(HEADER + bitBytes(size));
  raw[0] = SHARE_VERSION;
  raw[1] = stoneIndex;
  raw[2] = shapeIndex < 0 ? NO_SHAPE : shapeIndex;
  raw[3] = Math.max(0, Math.min(3, stars | 0));
  raw[4] = size;
  let k = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 1; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = cells[x + size * (y + size * z)];
        if (v !== EMPTY && v !== PEDESTAL) raw[HEADER + (k >>> 3)] |= 1 << (k & 7);
        k++;
      }
    }
  }
  return toBase64Url(await deflate(raw));
}

// Read the text of a link. Return a promise for the statue
// { size, cells, stone, shape, stars }. Throw an error for a bad link.
export async function decodeShare(text, maxSize = 64) {
  const packed = fromBase64Url(text);
  let raw;
  try {
    raw = await inflate(packed, HEADER + bitBytes(maxSize));
  } catch {
    throw new Error('The link is not correct.');
  }
  if (raw.length < HEADER || raw[0] !== SHARE_VERSION) throw new Error('The link is not correct.');
  const stone = STONE_NAMES[raw[1]];
  const shape = raw[2] === NO_SHAPE ? null : SHAPE_NAMES[raw[2]];
  const stars = raw[3];
  const size = raw[4];
  if (!stone || shape === undefined || stars > 3 || size < 1 || size > maxSize) throw new Error('The link is not correct.');
  if (raw.length !== HEADER + bitBytes(size)) throw new Error('The link is not correct.');
  const hardness = hardnessOf(stone);
  const cells = new Uint8Array(size ** 3);
  let k = 0;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) cells[x + size * size * z] = PEDESTAL;
    for (let y = 1; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((raw[HEADER + (k >>> 3)] >>> (k & 7)) & 1) cells[x + size * (y + size * z)] = hardness;
        k++;
      }
    }
  }
  return { size, cells, stone, shape, stars };
}

// Find the text of a shared statue in the fragment of a link, or null.
export function shareTextFrom(hash) {
  return typeof hash === 'string' && hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : null;
}

// A short name for a shared statue, so that the same link adds the
// statue to the Museum only one time.
export function shareId(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `shared-${(h >>> 0).toString(36)}-${text.length.toString(36)}`;
}
