// A QR code encoder. This module does not use three.js or the DOM.
//
// It supports the byte mode, the error correction levels L and M, and
// the versions 1 to 40. It follows the QR code standard (ISO/IEC 18004).

// Error correction codewords in each block, for each version (index 0 is
// not used).
const ECC_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
};

// The number of error correction blocks, for each version.
const BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
};

const FORMAT_LEVEL = { L: 1, M: 0 };

// The number of modules that can hold data, for a version.
export function rawDataModules(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

export function dataCodewords(version, level) {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[level][version] * BLOCKS[level][version];
}

// The largest number of bytes that a version can hold in byte mode.
export function byteCapacity(version, level) {
  const countBits = version < 10 ? 8 : 16;
  return Math.floor((dataCodewords(version, level) * 8 - 4 - countBits) / 8);
}

// ---------------------------------------------------------------- Reed-Solomon

function gfMultiply(a, b) {
  let r = 0;
  for (let i = 7; i >= 0; i--) {
    r = (r << 1) ^ ((r >>> 7) * 0x11d);
    r ^= ((b >>> i) & 1) * a;
  }
  return r & 0xff;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

// ---------------------------------------------------------------- Encoding

function dataBits(bytes, version, level) {
  const bits = [];
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capacity = dataCodewords(version, level) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    out.push(b);
  }
  for (let pad = 0xec; out.length < capacity / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function addErrorCorrection(data, version, level) {
  const numBlocks = BLOCKS[level][version];
  const eccLen = ECC_PER_BLOCK[level][version];
  const raw = Math.floor(rawDataModules(version) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const length = shortLen - eccLen + (i < numShort ? 0 : 1);
    const block = data.slice(k, k + length);
    k += length;
    const ecc = rsRemainder(block, divisor);
    // Short blocks get a placeholder, so that all blocks have one length.
    if (i < numShort) block.push(0);
    blocks.push(block.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(block[i]);
    });
  }
  return out;
}

// ---------------------------------------------------------------- Modules

function alignmentPositions(version, size) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

class Matrix {
  constructor(size) {
    this.size = size;
    this.dark = Array.from({ length: size }, () => new Array(size).fill(false));
    this.fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  }

  setFixed(x, y, dark) {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }
}

function drawFinder(m, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= m.size || y >= m.size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      m.setFixed(x, y, d !== 2 && d !== 4);
    }
  }
}

function drawFormat(m, level, mask) {
  const data = (FORMAT_LEVEL[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  const s = m.size;
  for (let i = 0; i <= 5; i++) m.setFixed(8, i, bit(i));
  m.setFixed(8, 7, bit(6));
  m.setFixed(8, 8, bit(7));
  m.setFixed(7, 8, bit(8));
  for (let i = 9; i < 15; i++) m.setFixed(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) m.setFixed(s - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) m.setFixed(8, s - 15 + i, bit(i));
  m.setFixed(8, s - 8, true);
}

function drawVersion(m, version) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = m.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    m.setFixed(a, b, dark);
    m.setFixed(b, a, dark);
  }
}

function drawFunctionPatterns(m, version, level) {
  const s = m.size;
  for (let i = 0; i < s; i++) {
    m.setFixed(6, i, i % 2 === 0);
    m.setFixed(i, 6, i % 2 === 0);
  }
  drawFinder(m, 3, 3);
  drawFinder(m, s - 4, 3);
  drawFinder(m, 3, s - 4);
  const pos = alignmentPositions(version, s);
  const last = pos.length - 1;
  pos.forEach((x, i) => {
    pos.forEach((y, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) m.setFixed(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });
  // Keep the format places free. The mask decides their value later.
  drawFormat(m, level, 0);
  drawVersion(m, version);
}

function drawCodewords(m, codewords) {
  const s = m.size;
  let i = 0;
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? s - 1 - vert : vert;
        if (!m.fixed[y][x] && i < codewords.length * 8) {
          m.dark[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m, mask) {
  const test = MASKS[mask];
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.fixed[y][x] && test(x, y)) m.dark[y][x] = !m.dark[y][x];
    }
  }
}

// The penalty score of the standard. A lower score is easier to scan.
function penalty(m) {
  const s = m.size;
  const d = m.dark;
  let score = 0;
  const lineScore = (get) => {
    let run = 1;
    let result = 0;
    for (let i = 1; i <= s; i++) {
      if (i < s && get(i) === get(i - 1)) {
        run++;
      } else {
        if (run >= 5) result += run - 2;
        run = 1;
      }
    }
    const a = [true, false, true, true, true, false, true, false, false, false, false];
    const b = [...a].reverse();
    for (let i = 0; i + 11 <= s; i++) {
      let matchA = true;
      let matchB = true;
      for (let k = 0; k < 11; k++) {
        if (get(i + k) !== a[k]) matchA = false;
        if (get(i + k) !== b[k]) matchB = false;
      }
      if (matchA) result += 40;
      if (matchB) result += 40;
    }
    return result;
  };
  for (let y = 0; y < s; y++) score += lineScore((x) => d[y][x]);
  for (let x = 0; x < s; x++) score += lineScore((y) => d[y][x]);
  let dark = 0;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (d[y][x]) dark++;
      if (x < s - 1 && y < s - 1) {
        const c = d[y][x];
        if (c === d[y][x + 1] && c === d[y + 1][x] && c === d[y + 1][x + 1]) score += 3;
      }
    }
  }
  const total = s * s;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

// Make a QR code for the bytes (or a text in UTF-8). Use the smallest
// version that can hold the data, with level M when possible, else L.
// Return { size, version, level, dark(x, y) } or null when the data is too long.
export function makeQr(input, { maxVersion = 40 } = {}) {
  const bytes = typeof input === 'string' ? Array.from(new TextEncoder().encode(input)) : Array.from(input);
  let version = 0;
  let level = null;
  for (const lvl of ['M', 'L']) {
    for (let v = 1; v <= maxVersion; v++) {
      if (byteCapacity(v, lvl) >= bytes.length) {
        if (!level || v < version) {
          version = v;
          level = lvl;
        }
        break;
      }
    }
    if (level === 'M') break;
  }
  if (!level) return null;
  const size = version * 4 + 17;
  const codewords = addErrorCorrection(dataBits(bytes, version, level), version, level);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = new Matrix(size);
    drawFunctionPatterns(m, version, level);
    drawCodewords(m, codewords);
    applyMask(m, mask);
    drawFormat(m, level, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { m, score, mask };
  }
  const { m, mask } = best;
  return { size, version, level, mask, dark: (x, y) => m.dark[y][x] };
}
