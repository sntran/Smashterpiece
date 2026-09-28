// The treasures in 3D. A found treasure jumps out of the stone, turns,
// and shines.

import * as THREE from 'three';

// The names of the treasures are in src/core/i18n.js (treasure.<id>).
export const TREASURE_LOOKS = {
  coin: { emoji: '🪙' },
  shell: { emoji: '🐚' },
  bone: { emoji: '🦴' },
  key: { emoji: '🗝️' },
  sock: { emoji: '🧦' },
  cookie: { emoji: '🍪' },
  gem: { emoji: '💎' },
  ring: { emoji: '💍' },
  dino: { emoji: '🦕' },
  trophy: { emoji: '🏆' },
  pizza: { emoji: '🍕' },
  robot: { emoji: '🤖' },
  crown: { emoji: '👑' },
  unicorn: { emoji: '🦄' },
  rainbow: { emoji: '🌈' },
  alien: { emoji: '👽' },
  dragon: { emoji: '🐉' },
  ufo: { emoji: '🛸' },
  lantern: { emoji: '🏮' },
  kite: { emoji: '🪁' },
  mango: { emoji: '🥭' },
  balloon: { emoji: '🎈' },
  pho: { emoji: '🍜' },
  buffalo: { emoji: '🐃' },
  scooter: { emoji: '🛵' },
  teddy: { emoji: '🧸' },
  luckymoney: { emoji: '🧧' },
  octopus: { emoji: '🐙' },
  shootingstar: { emoji: '🌠' },
  castle: { emoji: '🏰' },
};

const textures = new Map();

export function emojiTexture(emoji) {
  if (!textures.has(emoji)) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 72);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(emoji, texture);
  }
  return textures.get(emoji);
}

let glowTexture = null;

function glow() {
  if (!glowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.translate(64, 64);
    for (let k = 0; k < 12; k++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = k % 2 ? 'rgba(255,230,120,0.8)' : 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-9, -62);
      ctx.lineTo(9, -62);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-64, -64, 128, 128);
    glowTexture = new THREE.CanvasTexture(canvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return glowTexture;
}

const LIFE = 1.8;

export class TreasureView {
  constructor() {
    this.group = new THREE.Group();
    this.items = [];
  }

  // Show a treasure that jumps out of the stone at `point`.
  reveal(point, id) {
    const look = TREASURE_LOOKS[id];
    const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), depthTest: false, transparent: true }));
    const item = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(look.emoji), depthTest: false, transparent: true }));
    rays.renderOrder = 20;
    item.renderOrder = 21;
    rays.position.copy(point);
    item.position.copy(point);
    this.group.add(rays, item);
    this.items.push({ rays, item, start: point.clone(), age: 0 });
  }

  update(dt) {
    const keep = [];
    for (const t of this.items) {
      t.age += dt;
      const a = t.age / LIFE;
      if (a >= 1) {
        this.group.remove(t.rays, t.item);
        t.rays.material.dispose();
        t.item.material.dispose();
        continue;
      }
      // Jump up with a bounce, stay, then get small.
      const pop = Math.min(1, t.age / 0.35);
      const bounce = 1 + Math.sin(pop * Math.PI) * 0.35;
      const out = a > 0.8 ? 1 - (a - 0.8) / 0.2 : 1;
      const size = 7 * pop * bounce * out;
      t.item.scale.set(size, size, 1);
      t.rays.scale.set(size * 2.2, size * 2.2, 1);
      t.item.position.copy(t.start);
      t.item.position.y += 6 * Math.min(1, t.age / 0.5);
      t.rays.position.copy(t.item.position);
      t.item.material.rotation = Math.sin(t.age * 8) * 0.25;
      t.rays.material.rotation = t.age * 1.5;
      keep.push(t);
    }
    this.items = keep;
  }

  clear() {
    for (const t of this.items) this.group.remove(t.rays, t.item);
    this.items = [];
  }
}
