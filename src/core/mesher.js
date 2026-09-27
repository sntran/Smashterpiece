// Make mesh data from voxels. This module does not use three.js or the DOM.
//
// The mesher makes a face only where a solid voxel touches an empty cell
// (face culling). It also calculates ambient occlusion for each corner, so
// that inner corners are darker.

// For each face: the normal, and the four corners in the order that makes
// a front face (counterclockwise from outside).
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

// Texture coordinates for the four corners of each face.
const FACE_UV = [[1, 0], [1, 1], [0, 1], [0, 0]];

// The light level for 0, 1, 2 or 3 solid voxels around a corner.
export const AO_LEVELS = [1.0, 0.78, 0.6, 0.45];

// Prepare the corner data one time: for each corner, the two side cells
// and the diagonal cell in front of the face.
for (const face of FACES) {
  face.ao = face.c.map((corner) => {
    const side = [];
    for (let axis = 0; axis < 3; axis++) {
      if (face.n[axis] !== 0) continue;
      const step = [0, 0, 0];
      step[axis] = corner[axis] === 1 ? 1 : -1;
      side.push(step);
    }
    const a = side[0].map((v, k) => v + face.n[k]);
    const b = side[1].map((v, k) => v + face.n[k]);
    const d = side[0].map((v, k) => v + side[1][k] + face.n[k]);
    return [a, b, d];
  });
}

// Build the mesh for the box from (x0, y0, z0) up to but not including
// (x1, y1, z1).
//
// options:
//   solid(x, y, z)            true when the cell is solid. It must work for
//                             cells out of the box too.
//   color(x, y, z, out)       write the red, green and blue values of the
//                             voxel into out.
//   tile(x, y, z, face)       optional. Return the texture tile number.
//   tiles                     the number of tiles in each row and column
//                             of the texture (default 1).
//   ao                        true to calculate ambient occlusion (default true).
//   skipFace(x, y, z, face)   optional. Return true to not make this face.
//
// Return { positions, normals, uvs, colors, indices, faces }.
export function buildMesh(options) {
  const { x0, y0, z0, x1, y1, z1, solid, color } = options;
  const tile = options.tile ?? null;
  const tiles = options.tiles ?? 1;
  const useAo = options.ao ?? true;
  const skipFace = options.skipFace ?? null;

  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const rgb = [1, 1, 1];
  const light = [1, 1, 1, 1];
  let faces = 0;

  for (let z = z0; z < z1; z++) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (!solid(x, y, z)) continue;
        let colored = false;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [nx, ny, nz] = face.n;
          if (solid(x + nx, y + ny, z + nz)) continue;
          if (skipFace && skipFace(x, y, z, f)) continue;
          if (!colored) {
            color(x, y, z, rgb);
            colored = true;
          }
          for (let k = 0; k < 4; k++) {
            if (!useAo) {
              light[k] = 1;
              continue;
            }
            const [a, b, d] = face.ao[k];
            const sa = solid(x + a[0], y + a[1], z + a[2]) ? 1 : 0;
            const sb = solid(x + b[0], y + b[1], z + b[2]) ? 1 : 0;
            const sd = solid(x + d[0], y + d[1], z + d[2]) ? 1 : 0;
            light[k] = AO_LEVELS[sa && sb ? 3 : sa + sb + sd];
          }
          const t = tile ? tile(x, y, z, f) : 0;
          const tu = (t % tiles) / tiles;
          const tv = Math.floor(t / tiles) / tiles;
          // Keep a small border in each tile, so that the tiles do not bleed.
          const pad = 0.02 / tiles;
          const span = 1 / tiles - 2 * pad;
          const base = faces * 4;
          for (let k = 0; k < 4; k++) {
            const c = face.c[k];
            positions.push(x + c[0], y + c[1], z + c[2]);
            normals.push(nx, ny, nz);
            uvs.push(tu + pad + FACE_UV[k][0] * span, 1 - (tv + pad + (1 - FACE_UV[k][1]) * span));
            colors.push(rgb[0] * light[k], rgb[1] * light[k], rgb[2] * light[k]);
          }
          // Turn the quad on the other diagonal when that looks smoother.
          if (light[0] + light[2] < light[1] + light[3]) {
            indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          } else {
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          faces++;
        }
      }
    }
  }

  const vertexCount = faces * 4;
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    faces,
  };
}
