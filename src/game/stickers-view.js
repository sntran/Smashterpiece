// The stickers in 3D. A googly eye is a small 3D ball with a pupil that
// jiggles. The other stickers are emoji pictures.

import * as THREE from 'three';
import { FACE_NORMALS } from '../core/decorate.js';
import { emojiTexture } from './treasures-view.js';
import { toonGradient } from './textures.js';

// The names of the stickers are in src/core/i18n.js (sticker.<type>).
export const STICKER_LOOKS = {
  eye: { emoji: '👀' },
  glasses: { emoji: '🕶️' },
  hat: { emoji: '🎩' },
  bow: { emoji: '🎀' },
  flower: { emoji: '🌸' },
  lips: { emoji: '👄' },
  star: { emoji: '⭐' },
  crown: { emoji: '👑' },
};

const SIZE = 5;
const EYE = 2.2;
const eyeWhite = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() });
const eyeBlack = new THREE.MeshBasicMaterial({ color: 0x1a1025 });
const ball = new THREE.SphereGeometry(1, 16, 12);
const plane = new THREE.PlaneGeometry(1, 1);
const materials = new Map();

function stickerMaterial(type) {
  if (!materials.has(type)) {
    materials.set(type, new THREE.MeshBasicMaterial({
      map: emojiTexture(STICKER_LOOKS[type].emoji),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    }));
  }
  return materials.get(type);
}

// Make the 3D object of one sticker, in grid coordinates.
export function makeSticker(s) {
  const n = new THREE.Vector3(...FACE_NORMALS[s.face]);
  const center = new THREE.Vector3(s.x + 0.5, s.y + 0.5, s.z + 0.5).addScaledVector(n, 0.5);
  const group = new THREE.Group();
  group.position.copy(center);
  if (s.type === 'eye') {
    const white = new THREE.Mesh(ball, eyeWhite);
    white.scale.set(EYE, EYE, EYE * 0.55);
    const pupil = new THREE.Mesh(ball, eyeBlack);
    pupil.scale.setScalar(EYE * 0.46);
    group.add(white, pupil);
    group.userData = { pupil, normal: n, phase: Math.random() * 10, wobble: 0 };
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    pupil.position.z = EYE * 0.55;
    return group;
  }
  const picture = new THREE.Mesh(plane, stickerMaterial(s.type));
  picture.scale.set(SIZE, SIZE, 1);
  if (s.face === 2) {
    // A sticker on a top face stands up, like a hat on a head.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: stickerMaterial(s.type).map, transparent: true }));
    sprite.scale.set(SIZE, SIZE, 1);
    sprite.position.y = SIZE * 0.42;
    group.add(sprite);
  } else {
    picture.position.z = 0.03;
    group.add(picture);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  }
  return group;
}

export class StickerView {
  constructor() {
    this.group = new THREE.Group();
    this.items = new Map();
    this.falling = [];
  }

  key(s) {
    return `${s.x},${s.y},${s.z},${s.face}`;
  }

  // Show the list of stickers. Keep the 3D objects that did not change.
  set(stickers) {
    const next = new Map();
    for (const s of stickers) {
      const key = this.key(s);
      const old = this.items.get(key);
      if (old && old.userData.type === s.type) {
        next.set(key, old);
        this.items.delete(key);
      } else {
        const object = makeSticker(s);
        object.userData.type = s.type;
        this.group.add(object);
        next.set(key, object);
      }
    }
    for (const object of this.items.values()) this.group.remove(object);
    this.items = next;
  }

  // Stickers that lose their voxel fall down and spin.
  drop(stickers) {
    for (const s of stickers) {
      const key = this.key(s);
      const object = this.items.get(key);
      if (!object) continue;
      this.items.delete(key);
      this.falling.push({ object, vel: new THREE.Vector3((Math.random() - 0.5) * 8, 10, (Math.random() - 0.5) * 8), age: 0 });
    }
  }

  // The eyes wobble more after a hit.
  shake(amount = 1) {
    for (const object of this.items.values()) {
      if (object.userData.pupil) object.userData.wobble = Math.min(1.5, object.userData.wobble + amount);
    }
  }

  update(dt, time, calm = false) {
    for (const object of this.items.values()) {
      const data = object.userData;
      if (!data.pupil) continue;
      data.wobble = Math.max(0, data.wobble - dt * 1.5);
      const move = (calm ? 0.1 : 0.18 + data.wobble * 0.3) * EYE;
      const t = time * (3 + data.wobble * 12) + data.phase;
      data.pupil.position.x = Math.sin(t * 1.3) * move;
      data.pupil.position.y = Math.cos(t * 1.7) * move - 0.1 * EYE;
    }
    const keep = [];
    for (const f of this.falling) {
      f.age += dt;
      f.vel.y -= 60 * dt;
      f.object.position.addScaledVector(f.vel, dt);
      f.object.rotation.z += dt * 8;
      if (f.age < 1.2) keep.push(f);
      else this.group.remove(f.object);
    }
    this.falling = keep;
  }

  clear() {
    for (const object of this.items.values()) this.group.remove(object);
    for (const f of this.falling) this.group.remove(f.object);
    this.items.clear();
    this.falling = [];
  }
}
