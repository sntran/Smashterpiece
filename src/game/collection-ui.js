// The treasures: find them, show the hints, and show the collection.
// These methods belong to the Game class (see main.js).

import * as THREE from 'three';
import { TREASURES, nearestOpening, loadCollection, addToCollection } from '../core/treasures.js';
import { TREASURE_LOOKS } from './treasures-view.js';
import { $ } from './dom.js';

// The time between two sparkles that show where a treasure is.
const HINT_TIME = 1.2;
export const RARITY = Object.fromEntries(TREASURES.map((t) => [t.id, t.rarity]));

export const collectionMethods = {
  // The player found a treasure. Keep it in the collection and show it.
  findTreasure(t) {
    let isNew = false;
    try {
      isNew = addToCollection(this.storage, t.id).isNew;
    } catch {
      // The storage is full. The player still sees the treasure.
    }
    const point = this.stoneView.toWorld(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    this.treasureView.reveal(point, t.id);
    for (let k = 0; k < 14; k++) {
      const vel = new THREE.Vector3((Math.random() - 0.5) * 18, 6 + Math.random() * 14, (Math.random() - 0.5) * 18);
      this.particles.spark(point, vel, 0.3 + Math.random() * 0.4, [1, 0.85, 0.2], 0.6 + Math.random() * 0.4);
    }
    this.sounds.treasure(RARITY[t.id]);
    const box = $('#found');
    $('.found-emoji', box).textContent = TREASURE_LOOKS[t.id].emoji;
    $('.found-name', box).textContent = TREASURE_LOOKS[t.id].name;
    box.className = `found ${RARITY[t.id]}${isNew ? ' new' : ''}`;
    void box.offsetWidth;
    box.classList.add('go');
    this.updateTreasureBadge();
  },

  // Show small sparkles near the treasures that are close to the air.
  showHints(dt) {
    this.hintClock += dt;
    if (this.hintClock < HINT_TIME) return;
    this.hintClock = 0;
    for (const t of this.treasures) {
      if (t.found) continue;
      const open = nearestOpening(this.grid, t, 3);
      if (!open) continue;
      const point = this.stoneView.toWorld(open[0] + 0.5, open[1] + 0.5, open[2] + 0.5);
      for (let k = 0; k < 3; k++) {
        const vel = new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3);
        this.particles.spark(point, vel, 0.25, [1, 0.9, 0.3], 0.7);
      }
    }
  },

  updateTreasureBadge() {
    const count = Object.keys(loadCollection(this.storage)).length;
    const badge = $('#treasure-badge');
    badge.textContent = `${count}/${TREASURES.length}`;
  },

  openTreasures() {
    const collection = loadCollection(this.storage);
    const grid = $('#treasure-grid');
    grid.innerHTML = '';
    for (const t of TREASURES) {
      const look = TREASURE_LOOKS[t.id];
      const count = collection[t.id] ?? 0;
      const card = document.createElement(count ? 'button' : 'div');
      card.className = `treasure ${t.rarity}${count ? ' got' : ''}`;
      if (count) {
        card.dataset.treasure = t.id;
        card.setAttribute('aria-label', look.name);
      }
      card.innerHTML = `<span class="t-emoji">${look.emoji}</span>`
        + `<span class="t-name">${count ? look.name : '?'}</span>`
        + (count > 1 ? `<span class="t-count">x${count}</span>` : '');
      grid.appendChild(card);
    }
    $('#treasure-count').textContent = `${Object.keys(collection).length} / ${TREASURES.length}`;
    this.show('treasures');
  },
};
