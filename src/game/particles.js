// Chips, dust and sparks. Each kind of particle uses one InstancedMesh, so
// that many particles need only a few draw calls.

import * as THREE from 'three';
import { toonGradient } from './textures.js';

const GRAVITY = 70;

class Pool {
  constructor(geometry, material, capacity) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.capacity = capacity;
    this.items = [];
  }

  add(item) {
    // When the pool is full, reuse the oldest particle.
    if (this.items.length >= this.capacity) this.items.shift();
    item.age = 0;
    item.quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    );
    item.axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.items.push(item);
  }
}

const tmpMatrix = new THREE.Matrix4();
const tmpScale = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpColor = new THREE.Color();

export class Particles {
  // `floorAt(x, z)` gives the floor height. `solidAt(p)` is true when the
  // world point p is in the stone.
  constructor(floorAt, solidAt) {
    this.floorAt = floorAt;
    this.solidAt = solidAt;
    this.group = new THREE.Group();
    this.chips = new Pool(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshToonMaterial({ gradientMap: toonGradient() }),
      500,
    );
    this.puffs = new Pool(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshToonMaterial({ gradientMap: toonGradient(), transparent: true, opacity: 0.85, depthWrite: false }),
      260,
    );
    this.sparks = new Pool(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial(),
      160,
    );
    this.puffs.mesh.renderOrder = 3;
    this.group.add(this.chips.mesh, this.puffs.mesh, this.sparks.mesh);
  }

  chip(pos, vel, size, color, life = 2.5 + Math.random() * 1.5) {
    this.chips.add({ pos: pos.clone(), vel: vel.clone(), size, color, life, spin: 6 + Math.random() * 10, rest: false });
  }

  puff(pos, vel, size, color, life = 0.7 + Math.random() * 0.6) {
    this.puffs.add({ pos: pos.clone(), vel: vel.clone(), size, color, life, spin: 1 });
  }

  spark(pos, vel, size, color, life = 0.35 + Math.random() * 0.3) {
    this.sparks.add({ pos: pos.clone(), vel: vel.clone(), size, color, life, spin: 12 });
  }

  update(dt) {
    this.updateChips(dt);
    this.updateSimple(this.puffs, dt, (p, t) => {
      p.vel.multiplyScalar(Math.max(0, 1 - dt * 2.5));
      p.vel.y += dt * 3;
      return p.size * Math.sqrt(Math.sin(Math.PI * Math.min(1, t)));
    });
    this.updateSimple(this.sparks, dt, (p, t) => {
      p.vel.y -= GRAVITY * 0.5 * dt;
      return p.size * (1 - t);
    });
  }

  updateChips(dt) {
    const pool = this.chips;
    const prev = new THREE.Vector3();
    let n = 0;
    const keep = [];
    for (const p of pool.items) {
      p.age += dt;
      if (p.age >= p.life) continue;
      if (!p.rest) {
        prev.copy(p.pos);
        p.vel.y -= GRAVITY * dt;
        p.pos.addScaledVector(p.vel, dt);
        if (this.solidAt(p.pos)) {
          // Bounce back from the stone.
          p.pos.copy(prev);
          p.vel.set(p.vel.x * -0.3, Math.abs(p.vel.y) * 0.3, p.vel.z * -0.3);
        }
        const floor = this.floorAt(p.pos.x, p.pos.z) + p.size * 0.5;
        if (p.pos.y < floor) {
          p.pos.y = floor;
          if (Math.abs(p.vel.y) < 4) {
            p.rest = true;
          } else {
            p.vel.y = -p.vel.y * 0.35;
            p.vel.x *= 0.6;
            p.vel.z *= 0.6;
            p.spin *= 0.5;
          }
        }
        tmpQuat.setFromAxisAngle(p.axis, p.spin * dt);
        p.quat.premultiply(tmpQuat);
      }
      const fade = Math.min(1, (p.life - p.age) / 0.4);
      tmpScale.setScalar(p.size * fade);
      tmpMatrix.compose(p.pos, p.quat, tmpScale);
      pool.mesh.setMatrixAt(n, tmpMatrix);
      tmpColor.setRGB(p.color[0], p.color[1], p.color[2]);
      pool.mesh.setColorAt(n, tmpColor);
      keep.push(p);
      n++;
    }
    pool.items = keep;
    pool.mesh.count = n;
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.mesh.instanceColor.needsUpdate = true;
  }

  updateSimple(pool, dt, scaleFor) {
    let n = 0;
    const keep = [];
    for (const p of pool.items) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.pos.addScaledVector(p.vel, dt);
      const s = scaleFor(p, p.age / p.life);
      tmpQuat.setFromAxisAngle(p.axis, p.spin * dt);
      p.quat.premultiply(tmpQuat);
      tmpScale.setScalar(Math.max(0.001, s));
      tmpMatrix.compose(p.pos, p.quat, tmpScale);
      pool.mesh.setMatrixAt(n, tmpMatrix);
      tmpColor.setRGB(p.color[0], p.color[1], p.color[2]);
      pool.mesh.setColorAt(n, tmpColor);
      keep.push(p);
      n++;
    }
    pool.items = keep;
    pool.mesh.count = n;
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    for (const pool of [this.chips, this.puffs, this.sparks]) {
      pool.items = [];
      pool.mesh.count = 0;
    }
  }
}
