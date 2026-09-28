// The automatic save, the Continue button, and the save file.
// These methods belong to the Game class (see main.js).

import { createBlock } from '../core/grid.js';
import { hardnessOf } from '../core/stones.js';
import { buildGhost } from '../core/shapes.js';
import { countOutside } from '../core/score.js';
import { saveProgress, loadProgress, makeBackup, parseBackup, mergeBackup } from '../core/save.js';
import { STONE_LOOKS } from './palette.js';
import { $ } from './dom.js';

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
    this.treasures = saved.treasures;
    this.outsideStart = saved.outsideStart || (this.ghost ? countOutside(this.grid, this.ghost.mask) : 0);
    this.history.clear();
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
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Smashterpiece' });
        $('#backup-result').textContent = 'The file is ready.';
        return;
      }
    } catch (error) {
      // The parent closed the share sheet. Use a download instead only
      // when the share failed for a different reason.
      if (error && error.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('#backup-result').textContent = 'The file is in your downloads.';
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
      const parts = [`${merged.statues} new statue${merged.statues === 1 ? '' : 's'}`,
        `${merged.treasures} new treasure${merged.treasures === 1 ? '' : 's'}`];
      if (merged.progress) parts.push('a game to continue');
      result.textContent = `Loaded: ${parts.join(', ')}.`;
      this.sounds.snap();
      this.confetti.burst(80);
    } catch {
      result.textContent = 'This file is not a Smashterpiece save file.';
      this.sounds.thud();
    }
    this.updateTreasureBadge();
    this.updateContinue();
  },
};
