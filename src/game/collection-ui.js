// The treasures and the badges: find them, show the hints, and show the
// collection. The methods belong to the Game class (see main.js).

import * as THREE from 'three';
import { TREASURES, nearestOpening, loadCollection, addToCollection } from '../core/treasures.js';
import { BADGES, loadStats, saveStats, recordEvent, newBadges, earnedBadges, keepBadges } from '../core/badges.js';
import { TREASURE_LOOKS } from './treasures-view.js';
import { $ } from './dom.js';

// The words for the badges are in src/core/i18n.js (badge.<id> and
// badge.<id>.hint).
export const BADGE_LOOKS = {
  'first-smash': { emoji: '🔨' },
  'hundred-hits': { emoji: '💪' },
  'big-crash': { emoji: '💥' },
  explorer: { emoji: '🌍' },
  'star-sculptor': { emoji: '🌟' },
  'shape-champion': { emoji: '🏆' },
  'letter-carver': { emoji: '🔤' },
  'museum-builder': { emoji: '🏛️' },
  painter: { emoji: '🎨' },
  'silly-face': { emoji: '🤪' },
  sharer: { emoji: '💌' },
  'treasure-hunter': { emoji: '🧭' },
  'treasure-master': { emoji: '👑' },
  'treasure-legend': { emoji: '🐉' },
};

// Keep the stats, and tell the game about each new badge.
export class StatsKeeper {
  constructor(storage, onBadge) {
    this.storage = storage;
    this.onBadge = onBadge;
    this.stats = keepBadges(loadStats(storage));
  }

  event(name, data) {
    const before = this.stats;
    this.stats = keepBadges(recordEvent(before, name, data));
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
    const name = this.t(`treasure.${t.id}`);
    $('.found-name', box).textContent = name;
    $('.new-badge', box).textContent = this.t('tag.new');
    box.className = `found ${RARITY[t.id]}${isNew ? ' new' : ''}`;
    void box.offsetWidth;
    box.classList.add('go');
    this.announce(this.t('news.found', { name }), true);
    this.updateTreasureBadge();
    this.stats.event('treasures', { kinds: Object.keys(loadCollection(this.storage)).length });
  },

  // Show a new badge, a short time after other news. While a dialog is
  // open, wait: the badge must not cover the dialog.
  showBadge(id) {
    const look = BADGE_LOOKS[id];
    const name = this.t(`badge.${id}`);
    const show = () => {
      if ($('.overlay.show')) {
        setTimeout(show, 700);
        return;
      }
      const box = $('#found');
      $('.found-emoji', box).textContent = look.emoji;
      $('.found-name', box).textContent = name;
      $('.new-badge', box).textContent = this.t('tag.badge');
      box.className = 'found rare new';
      void box.offsetWidth;
      box.classList.add('go');

      this.sounds.treasure('rare');
      this.announce(this.t('news.badge', { name }), true);
    };
    setTimeout(show, 900);
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
        card.setAttribute('aria-label', this.t(`treasure.${t.id}`));
      }
      card.innerHTML = `<span class="t-emoji">${look.emoji}</span>`
        + `<span class="t-name">${count ? this.t(`treasure.${t.id}`) : '?'}</span>`
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
      const name = this.t(`badge.${b.id}`);
      const hint = this.t(`badge.${b.id}.hint`);
      card.setAttribute('aria-label', got ? this.t('book.badge', { name }) : this.t('book.notYet', { hint }));
      card.innerHTML = `<span class="t-emoji" aria-hidden="true">${look.emoji}</span><span class="t-name">${name}</span>`
        + `<span class="t-hint">${got ? '' : hint}</span>`;
      badges.appendChild(card);
    }
    $('#badge-count').textContent = `${earned.size} / ${BADGES.length}`;
    this.show('treasures');
  },
};
