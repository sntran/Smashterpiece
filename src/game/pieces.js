// Pieces that do not connect to the pedestal. They shake, fall, and break
// into chips when they hit something.

import * as THREE from 'three';
import { buildMesh } from '../core/mesher.js';
import { voxelMeshOptions, geometryFrom, stoneMaterial } from './stone-view.js';
import { isClear } from './palette.js';

const GRAVITY = 70;
const SHAKE_TIME = 0.18;

export class FallingPieces {
  constructor({ stoneView, particles, sounds, floorAt, solidAt, colorOf }) {
    this.view = stoneView;
    this.particles = particles;
    this.sounds = sounds;
    this.floorAt = floorAt;
    this.solidAt = solidAt;
    this.colorOf = colorOf;
    this.group = new THREE.Group();
    this.items = [];
  }

  // `piece` is a list of { index, value } items.
  add(piece, grid, stone, hardness) {
    const size = grid.size;
    const xyz = [0, 0, 0];
    const cells = new Map();
    let min = [size, size, size];
    let max = [0, 0, 0];
    const center = new THREE.Vector3();
    for (const { index, value } of piece) {
      cells.set(index, value);
      grid.coords(index, xyz);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], xyz[k]);
        max[k] = Math.max(max[k], xyz[k]);
      }
      center.x += xyz[0] + 0.5;
      center.y += xyz[1] + 0.5;
      center.z += xyz[2] + 0.5;
    }
    center.divideScalar(piece.length);

    // Very small pieces break at once.
    if (piece.length < 4) {
      for (const { index } of piece) {
        grid.coords(index, xyz);
        const p = this.view.toWorld(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5);
        this.particles.chip(p, new THREE.Vector3((Math.random() - 0.5) * 8, 4, (Math.random() - 0.5) * 8), 0.6, this.colorOf(index));
      }
      return;
    }

    const valueAt = (x, y, z) => {
      if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) return 0;
      return cells.get(x + size * (y + size * z)) ?? 0;
    };
    const options = voxelMeshOptions({ valueAt, size, stone, hardness });
    const data = buildMesh({
      x0: min[0], y0: min[1], z0: min[2], x1: max[0] + 1, y1: max[1] + 1, z1: max[2] + 1,
      ...options,
      skipFace: null,
    });
    const geometry = geometryFrom(data);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, stoneMaterial(stone));
    this.view.toWorld(center.x, center.y, center.z, mesh.position);
    this.group.add(mesh);

    // Push the piece away from the middle of the stone.
    const out = new THREE.Vector3(mesh.position.x, 0, mesh.position.z);
    if (out.lengthSq() < 1) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    out.normalize().multiplyScalar(5 + Math.random() * 4);

    const local = [];
    for (const { index } of piece) {
      grid.coords(index, xyz);
      local.push({ index, p: new THREE.Vector3(xyz[0] + 0.5 - center.x, xyz[1] + 0.5 - center.y, xyz[2] + 0.5 - center.z) });
    }
    this.items.push({
      mesh,
      local,
      start: mesh.position.clone(),
      vel: new THREE.Vector3(out.x, 6, out.z),
      spin: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4),
      age: 0,
      halfHeight: (max[1] - min[1] + 1) / 2,
      count: piece.length,
      stone,
    });
    if (piece.length > 12) this.sounds.whee(piece.length);
  }

  update(dt) {
    const keep = [];
    for (const item of this.items) {
      item.age += dt;
      const mesh = item.mesh;
      if (item.age < SHAKE_TIME) {
        // Shake a little before the fall.
        mesh.position.copy(item.start);
        mesh.position.x += (Math.random() - 0.5) * 0.5;
        mesh.position.z += (Math.random() - 0.5) * 0.5;
        keep.push(item);
        continue;
      }
      item.vel.y -= GRAVITY * dt;
      mesh.position.addScaledVector(item.vel, dt);
      mesh.rotation.x += item.spin.x * dt;
      mesh.rotation.y += item.spin.y * dt;
      mesh.rotation.z += item.spin.z * dt;
      const bottom = mesh.position.clone();
      bottom.y -= item.halfHeight * 0.8;
      const floor = this.floorAt(bottom.x, bottom.z);
      const falling = item.age > SHAKE_TIME + 0.08;
      if (bottom.y <= floor || (falling && item.vel.y < 0 && this.solidAt(bottom))) {
        this.shatter(item);
      } else {
        keep.push(item);
      }
    }
    this.items = keep;
  }

  shatter(item) {
    const mesh = item.mesh;
    mesh.updateMatrixWorld();
    const step = Math.max(1, Math.floor(item.local.length / 70));
    const p = new THREE.Vector3();
    for (let k = 0; k < item.local.length; k += step) {
      const { index, p: local } = item.local[k];
      p.copy(local).applyMatrix4(mesh.matrixWorld);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 16, 6 + Math.random() * 12, (Math.random() - 0.5) * 16);
      if (item.stone === 'sand') {
        // Sand falls apart into small grains.
        this.particles.chip(p, vel.multiplyScalar(0.4), 0.2 + Math.random() * 0.25, this.colorOf(index));
      } else if (isClear(item.stone) && k % 2 === 0) {
        const color = Math.random() < 0.4 ? [1, 1, 1] : [0.55, 0.9, 1];
        this.particles.spark(p, vel, 0.4 + Math.random() * 0.5, color, 0.6 + Math.random() * 0.4);
      } else {
        this.particles.chip(p, vel, 0.5 + Math.random() * 0.7, this.colorOf(index));
      }
    }
    const dust = Math.min(14, 3 + Math.floor(item.count / 20));
    for (let k = 0; k < dust; k++) {
      const vel = new THREE.Vector3((Math.random() - 0.5) * 10, 2 + Math.random() * 3, (Math.random() - 0.5) * 10);
      this.particles.puff(mesh.position, vel, 1.5 + Math.random() * 2.5, [1, 1, 1]);
    }
    if (item.stone === 'sand') this.sounds.pour(0.8);
    else this.sounds.crash(item.count);
    if (isClear(item.stone)) this.sounds.shatter(item.count);
    this.group.remove(mesh);
    mesh.geometry.dispose();
  }

  clear() {
    for (const item of this.items) {
      this.group.remove(item.mesh);
      item.mesh.geometry.dispose();
    }
    this.items = [];
  }
}
