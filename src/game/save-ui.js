// The automatic save, the Continue button, and the save file.
// These methods belong to the Game class (see main.js).

import { createBlock } from '../core/grid.js';
import { hardnessOf } from '../core/stones.js';
import { buildGhost } from '../core/shapes.js';
import { countOutside } from '../core/score.js';
import { saveProgress, loadProgress, makeBackup, parseBackup, mergeBackup, SAVED_UNDO_STEPS } from '../core/save.js';
import { STONE_LOOKS } from './palette.js';
import { $, offerFile } from './dom.js';

// The time from the last hit to the automatic save, in milliseconds.
const AUTOSAVE_DELAY = 800;

export const saveMethods = {
  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), AUTOSAVE_DELAY);
  },

  // Save the game in progress at once.
  saveNow() {
    clearTimeout(this.saveTimer);
    if (!this.playing || !this.grid) return;
    try {
      saveProgress(this.storage, {
        mode: this.mode,
        stone: this.stone,
        shape: this.shape,
        size: this.grid.size,
        cells: this.grid.cells,
        paint: this.grid.paint,
        stickers: this.stickers,
        undo: this.history.last(SAVED_UNDO_STEPS),
        treasures: this.treasures,
        outsideStart: this.outsideStart,
        finished: !!this.finished,
        saved: Date.now(),
      });
    } catch {
      // The storage is full. The game continues without the save.
    }
  },

  // Show the Continue button when there is a saved game.
  updateContinue() {
    const saved = loadProgress(this.storage);
    const button = $('[data-action="continue"]');
    button.style.display = saved ? '' : 'none';
    if (saved) button.style.background = STONE_LOOKS[saved.stone].swatch;
  },

  // A new game replaces the saved game. Ask first.
  async confirmNewGame() {
    if (!loadProgress(this.storage)) return true;
    // The saved game goes away only when the new block starts.
    return this.ask('newStone');
  },

  resumeGame() {
    const saved = loadProgress(this.storage);
    if (!saved) return this.updateContinue();
    this.mode = saved.mode;
    this.shape = saved.shape;
    this.stone = saved.stone;
    this.hardness = hardnessOf(saved.stone);
    this.ghost = saved.mode === 'challenge' ? buildGhost(saved.shape, saved.size) : null;
    this.grid = createBlock({ size: saved.size, hardness: this.hardness });
    this.grid.copyFrom(saved.cells);
    this.grid.paint.set(saved.paint);
    this.stickers = saved.stickers;
    this.stickerView.clear();
    this.stickerView.set(this.stickers);
    this.treasures = saved.treasures;
    this.outsideStart = saved.outsideStart || (this.ghost ? countOutside(this.grid, this.ghost.mask) : 0);
    this.history.clear();
    this.history.load(saved.undo);
    this.pieces.clear();
    this.particles.clear();
    this.treasureView.clear();
    this.ghostVisible = true;
    this.stoneView.setStone(this.grid, saved.stone, this.hardness, this.ghost);
    this.unsaved = true;
    this.finished = saved.finished;
    this.lastScore = null;
    this.playing = true;
    this.resetCamera();
    this.show('play');
    this.setTool(this.tool);
    this.updateButtons();
    this.updateScore(true);
    return undefined;
  },

  // Put all data of the game in a file. On a phone, the share sheet lets
  // a parent keep the file, for example in Files or in Google Drive.
  async exportBackup() {
    this.saveNow();
    const date = new Date().toISOString().slice(0, 10);
    const name = `smashterpiece-${date}.json`;
    const text = JSON.stringify(makeBackup(this.storage));
    const file = new File([text], name, { type: 'application/json' });
    const result = await offerFile(file);
    if (result === 'shared') $('#backup-result').textContent = this.t('backup.ready');
    if (result === 'downloaded') $('#backup-result').textContent = this.t('backup.downloaded');
  },

  // Load a backup file and add its data to this device.
  async importBackup(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const result = $('#backup-result');
    try {
      const backup = parseBackup(await file.text());
      const merged = mergeBackup(this.storage, backup);
      const parts = [
        this.t('backup.statues', { count: merged.statues }),
        this.t('backup.treasures', { count: merged.treasures }),
      ];
      if (merged.progress) parts.push(this.t('backup.progress'));
      result.textContent = this.t('backup.loaded', { parts: parts.join(', ') });
      this.sounds.snap();
      this.confetti.burst(80);
    } catch {
      result.textContent = this.t('backup.bad');
      this.sounds.thud();
    }
    this.updateTreasureBadge();
    this.updateContinue();
  },
};
