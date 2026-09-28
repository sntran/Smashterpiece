// Make a 3D print file (binary STL) from a statue. This module does not use
// three.js or the DOM.
//
// Each voxel becomes a small cube. Only the outer faces go into the file,
// so the file is a closed surface. The pedestal layer is the flat base of
// the print. The STL file uses millimeters, with the Z axis up.

import { buildMesh } from './mesher.js';
import { EMPTY } from './grid.js';

export const VOXEL_MM = 2;
const HEADER_BYTES = 80;
const TRIANGLE_BYTES = 50;

// Return an ArrayBuffer with the binary STL data.
export function statueToStl(size, cells, voxelMm = VOXEL_MM) {
  const solid = (x, y, z) =>
    x >= 0 && y >= 0 && z >= 0 && x < size && y < size && z < size && cells[x + size * (y + size * z)] !== EMPTY;
  const mesh = buildMesh({
    x0: 0, y0: 0, z0: 0, x1: size, y1: size, z1: size,
    solid,
    color: (x, y, z, out) => { out[0] = 1; out[1] = 1; out[2] = 1; },
    ao: false,
  });
  const triangles = mesh.indices.length / 3;
  const buffer = new ArrayBuffer(HEADER_BYTES + 4 + triangles * TRIANGLE_BYTES);
  const view = new DataView(buffer);
  const title = 'Smashterpiece statue';
  for (let i = 0; i < title.length; i++) view.setUint8(i, title.charCodeAt(i));
  view.setUint32(HEADER_BYTES, triangles, true);
  const p = mesh.positions;
  const n = mesh.normals;
  // The game uses Y up. The STL file uses Z up: (x, y, z) becomes (x, z, y).
  // This change turns the triangles inside out, so the corners go in the
  // other order.
  const point = (v) => [p[v * 3] * voxelMm, p[v * 3 + 2] * voxelMm, p[v * 3 + 1] * voxelMm];
  let offset = HEADER_BYTES + 4;
  for (let t = 0; t < triangles; t++) {
    const a = mesh.indices[t * 3];
    const b = mesh.indices[t * 3 + 1];
    const c = mesh.indices[t * 3 + 2];
    const normal = [n[a * 3], n[a * 3 + 2], n[a * 3 + 1]];
    for (const value of [...normal, ...point(a), ...point(c), ...point(b)]) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return buffer;
}

// Read the triangles back from binary STL data (for the tests).
export function readStl(buffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(HEADER_BYTES, true);
  const triangles = [];
  let offset = HEADER_BYTES + 4;
  for (let t = 0; t < count; t++) {
    const f = [];
    for (let k = 0; k < 12; k++) f.push(view.getFloat32(offset + k * 4, true));
    triangles.push({ normal: f.slice(0, 3), a: f.slice(3, 6), b: f.slice(6, 9), c: f.slice(9, 12) });
    offset += TRIANGLE_BYTES;
  }
  return triangles;
}
