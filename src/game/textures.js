// Textures that the game draws on a canvas at start. The game does not
// load image files.

import * as THREE from 'three';

// The stone texture is an atlas with 4 x 4 tiles.
// Columns 0, 1 and 2: no cracks, small cracks, large cracks.
// Column 3: the pedestal. Each row is a different variant.
export const ATLAS_TILES = 4;
const TILE = 128;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

// Draw the fine grain of the stone. The colors are near white, because
// the vertex colors give the main color.
function drawGrain(ctx, x0, y0, stone, rand) {
  const img = ctx.getImageData(x0, y0, TILE, TILE);
  const d = img.data;
  for (let y = 0; y < TILE; y++) {
    const band = stone === 'sandstone' ? Math.sin(y * 0.35 + rand() * 0.2) * 7 : 0;
    for (let x = 0; x < TILE; x++) {
      const k = (y * TILE + x) * 4;
      const amount = stone === 'marble' || stone === 'glass' ? 6 : stone === 'sand' ? 40 : 22;
      const grain = (rand() - 0.5) * amount;
      const v = 238 + band + grain;
      d[k] = v;
      d[k + 1] = v;
      d[k + 2] = v;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, x0, y0);
  if (stone === 'marble') {
    for (let n = 0; n < 5; n++) {
      const cx = x0 + rand() * TILE;
      const cy = y0 + rand() * TILE;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + rand() * 40);
      g.addColorStop(0, 'rgba(200,200,225,0.25)');
      g.addColorStop(1, 'rgba(200,200,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, TILE, TILE);
    }
  }
  if (stone === 'sand') {
    for (let n = 0; n < 90; n++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(150,110,60,0.35)' : 'rgba(255,255,255,0.6)';
      ctx.fillRect(x0 + rand() * TILE, y0 + rand() * TILE, 3, 3);
    }
  }
  if (stone === 'glass') {
    // Shiny lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x0 + 28, y0 + 60);
    ctx.lineTo(x0 + 60, y0 + 28);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x0 + 34, y0 + 84);
    ctx.lineTo(x0 + 84, y0 + 34);
    ctx.stroke();
  }
  if (stone === 'granite') {
    const colors = ['#4b4652', '#ffffff', '#ffb8c6', '#2d2a33'];
    for (let n = 0; n < 40; n++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      const r = 1.5 + rand() * 2.5;
      ctx.beginPath();
      ctx.arc(x0 + rand() * TILE, y0 + rand() * TILE, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draw a soft edge on each tile, so that each voxel looks like a small block.
function drawBevel(ctx, x0, y0) {
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x0 + 3, y0 + TILE - 3);
  ctx.lineTo(x0 + 3, y0 + 3);
  ctx.lineTo(x0 + TILE - 3, y0 + 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,20,60,0.18)';
  ctx.beginPath();
  ctx.moveTo(x0 + TILE - 3, y0 + 3);
  ctx.lineTo(x0 + TILE - 3, y0 + TILE - 3);
  ctx.lineTo(x0 + 3, y0 + TILE - 3);
  ctx.stroke();
}

function drawCrack(ctx, x0, y0, rand) {
  // Start at an edge and go into the tile.
  const side = Math.floor(rand() * 4);
  let x = side === 0 ? 0 : side === 1 ? TILE : rand() * TILE;
  let y = side === 2 ? 0 : side === 3 ? TILE : rand() * TILE;
  let angle = Math.atan2(TILE / 2 - y, TILE / 2 - x);
  const points = [[x, y]];
  const steps = 5 + Math.floor(rand() * 4);
  for (let k = 0; k < steps; k++) {
    angle += (rand() - 0.5) * 1.3;
    const len = 10 + rand() * 12;
    x = Math.min(TILE - 4, Math.max(4, x + Math.cos(angle) * len));
    y = Math.min(TILE - 4, Math.max(4, y + Math.sin(angle) * len));
    points.push([x, y]);
  }
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x0 + points[0][0], y0 + points[0][1]);
    for (const [px, py] of points.slice(1)) ctx.lineTo(x0 + px, y0 + py);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 12;
  path();
  ctx.stroke();
  ctx.strokeStyle = '#3b2a52';
  ctx.lineWidth = 7;
  path();
  ctx.stroke();
}

function drawPedestal(ctx, x0, y0) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, TILE, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x0 + TILE / 2, y0 + TILE / 2, 14, 0, Math.PI * 2);
  ctx.fill();
}

const atlasCache = new Map();

export function stoneAtlas(stone) {
  if (atlasCache.has(stone)) return atlasCache.get(stone);
  const size = TILE * ATLAS_TILES;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rand = seeded(stone.length * 7919 + stone.charCodeAt(0));
  for (let row = 0; row < ATLAS_TILES; row++) {
    for (let col = 0; col < ATLAS_TILES; col++) {
      const x0 = col * TILE;
      const y0 = row * TILE;
      if (col === 3) {
        drawPedestal(ctx, x0, y0);
      } else {
        drawGrain(ctx, x0, y0, stone, rand);
        for (let k = 0; k < (col === 0 ? 0 : col === 1 ? 1 : 3); k++) drawCrack(ctx, x0, y0, rand);
      }
      drawBevel(ctx, x0, y0);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  atlasCache.set(stone, texture);
  return texture;
}

let toonRamp = null;

// The light steps of the cartoon look.
export function toonGradient() {
  if (toonRamp) return toonRamp;
  toonRamp = new THREE.DataTexture(new Uint8Array([95, 160, 215, 255]), 4, 1, THREE.RedFormat);
  toonRamp.minFilter = THREE.NearestFilter;
  toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.generateMipmaps = false;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

// A sky with soft colors from top to bottom.
export function skyTexture(top = '#6ec8ff', bottom = '#fff4c9') {
  const canvas = makeCanvas(4, 256);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.65, '#bfe9ff');
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A round floor with rings of color.
export function floorTexture() {
  const canvas = makeCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  const colors = ['#8ee07a', '#a7ec8f'];
  for (let r = 16; r >= 1; r--) {
    ctx.fillStyle = colors[r % 2];
    ctx.beginPath();
    ctx.arc(256, 256, r * 16, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A checker floor for the Museum.
export function checkerTexture(a = '#ffe3a3', b = '#ffc971', repeat = 8) {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillRect(64, 64, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

// A Museum wall with stripes and a row of party flags.
export function wallTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = (x / 32) % 2 ? '#ffd6e7' : '#ffe8f1';
    ctx.fillRect(x, 0, 32, 256);
  }
  const flags = ['#ff5d73', '#ffd35c', '#4cc9f0', '#4ade80', '#b388ff'];
  ctx.strokeStyle = '#3b2a52';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.quadraticCurveTo(128, 60, 256, 30);
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const x = 8 + k * 32;
    const t = (x + 12) / 256;
    const y = 30 + 4 * 30 * t * (1 - t);
    ctx.fillStyle = flags[k % flags.length];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 24, y);
    ctx.lineTo(x + 12, y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// A sun with a happy face.
export function sunTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  ctx.translate(128, 128);
  ctx.fillStyle = '#ffb703';
  for (let k = 0; k < 12; k++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(-14, -80);
    ctx.lineTo(0, -122);
    ctx.lineTo(14, -80);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd35c';
  ctx.strokeStyle = '#ff9f1c';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3b2a52';
  ctx.beginPath();
  ctx.arc(-28, -16, 9, 0, Math.PI * 2);
  ctx.arc(28, -16, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8fa3';
  ctx.beginPath();
  ctx.arc(-46, 12, 11, 0, Math.PI * 2);
  ctx.arc(46, 12, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b2a52';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 8, 30, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A small picture of a stone for the stone buttons.
export function drawStoneSwatch(canvas, stone, colorAt) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cell = w / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const c = colorAt(x * 2, 20 - y * 2, 31);
      ctx.fillStyle = `rgb(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0})`;
      ctx.fillRect(x * cell, y * (h / 8), cell + 1, h / 8 + 1);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 8; k++) {
    ctx.beginPath();
    ctx.moveTo(k * cell, 0);
    ctx.lineTo(k * cell, h);
    ctx.moveTo(0, k * (h / 8));
    ctx.lineTo(w, k * (h / 8));
    ctx.stroke();
  }
}
