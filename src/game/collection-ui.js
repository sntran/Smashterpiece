// The treasures and the badges: find them, show the hints, and show the
// collection. The methods belong to the Game class (see main.js).

import * as THREE from 'three';
import { TREASURES, nearestOpening, loadCollection, addToCollection } from '../core/treasures.js';
import { BADGES, loadStats, saveStats, recordEvent, newBadges, earnedBadges } from '../core/badges.js';
import { TREASURE_LOOKS } from './treasures-view.js';
import { $ } from './dom.js';

export const BADGE_LOOKS = {
  'first-smash': { emoji: '🔨', name: 'First Smash', hint: 'Hit a stone.' },
  'hundred-hits': { emoji: '💪', name: '100 Hits', hint: 'Hit 100 times.' },
  'big-crash': { emoji: '💥', name: 'Big Crash', hint: 'Make a big piece fall.' },
  explorer: { emoji: '🌍', name: 'Explorer', hint: 'Carve all the materials.' },
  'star-sculptor': { emoji: '🌟', name: 'Star Sculptor', hint: 'Get 3 stars.' },
  'shape-champion': { emoji: '🏆', name: 'Shape Champion', hint: 'Get 3 stars on all the pictures.' },
  'letter-carver': { emoji: '🔤', name: 'Letter Carver', hint: 'Finish a letter.' },
  'museum-builder': { emoji: '🏛️', name: 'Museum Builder', hint: 'Save 5 statues.' },
  painter: { emoji: '🎨', name: 'Painter', hint: 'Paint 100 blocks.' },
  'silly-face': { emoji: '🤪', name: 'Silly Face', hint: 'Put on 2 googly eyes.' },
  sharer: { emoji: '💌', name: 'Sharer', hint: 'Share a statue.' },
  'treasure-hunter': { emoji: '🧭', name: 'Treasure Hunter', hint: 'Find 5 kinds of treasure.' },
  'treasure-master': { emoji: '👑', name: 'Treasure Master', hint: 'Find all the treasures.' },
};

// Keep the stats, and tell the game about each new badge.
export class StatsKeeper {
  constructor(storage, onBadge) {
    this.storage = storage;
    this.onBadge = onBadge;
    this.stats = loadStats(storage);
  }

  event(name, data) {
    const before = this.stats;
    this.stats = recordEvent(before, name, data);
    try {
      saveStats(this.storage, this.stats);
    } catch {
      // The storage is full. The badges stay for this visit.
    }
    for (const id of newBadges(before, this.stats)) this.onBadge(id);
  }

  earned() {
    return earnedBadges(this.stats);
  }
}

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
    this.announce(`You found a ${TREASURE_LOOKS[t.id].name}!`, true);
    this.updateTreasureBadge();
    this.stats.event('treasures', { kinds: Object.keys(loadCollection(this.storage)).length });
  },

  // Show a new badge, a short time after other news.
  showBadge(id) {
    const look = BADGE_LOOKS[id];
    setTimeout(() => {
      const box = $('#found');
      $('.found-emoji', box).textContent = look.emoji;
      $('.found-name', box).textContent = look.name;
      $('.new-badge', box).textContent = 'BADGE!';
      box.className = 'found rare new';
      void box.offsetWidth;
      box.classList.add('go');
      setTimeout(() => { $('.new-badge', box).textContent = 'NEW!'; }, 2300);
      this.sounds.treasure('rare');
      this.announce(`New badge: ${look.name}!`, true);
    }, 900);
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
    const earned = new Set(this.stats.earned());
    const badges = $('#badge-grid');
    badges.innerHTML = '';
    for (const b of BADGES) {
      const look = BADGE_LOOKS[b.id];
      const got = earned.has(b.id);
      const card = document.createElement('div');
      card.className = `treasure badge ${got ? 'got' : ''}`;
      card.setAttribute('role', 'img');
      card.setAttribute('aria-label', got ? `Badge: ${look.name}` : `Badge not earned yet: ${look.hint}`);
      card.innerHTML = `<span class="t-emoji">${look.emoji}</span><span class="t-name">${look.name}</span>`
        + `<span class="t-hint">${got ? '' : look.hint}</span>`;
      badges.appendChild(card);
    }
    $('#badge-count').textContent = `${earned.size} / ${BADGES.length}`;
    this.show('treasures');
  },
};
