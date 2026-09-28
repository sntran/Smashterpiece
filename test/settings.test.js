import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SETTINGS_KEY, loadSettings, saveSettings, defaultSettings } from '../src/core/settings.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('the defaults follow the device', () => {
  assert.equal(defaultSettings().reduceMotion, false);
  assert.equal(defaultSettings({ reduceMotion: true }).reduceMotion, true);
  assert.equal(defaultSettings({ contrast: true }).contrast, true);
  assert.equal(DEFAULTS.speak, false);
});

test('the settings are saved and loaded', () => {
  const storage = memoryStorage();
  const settings = { ...defaultSettings(), easyControls: true, music: false };
  saveSettings(storage, settings);
  assert.deepEqual(loadSettings(storage), settings);
});

test('a saved setting wins over the device default', () => {
  const storage = memoryStorage();
  saveSettings(storage, { ...defaultSettings(), reduceMotion: false });
  assert.equal(loadSettings(storage, { reduceMotion: true }).reduceMotion, false);
});

test('bad settings get the defaults', () => {
  const storage = memoryStorage();
  storage.setItem(SETTINGS_KEY, '{"speak": "yes", "music": false, "rocket": true}');
  const settings = loadSettings(storage);
  assert.equal(settings.speak, false);
  assert.equal(settings.music, false);
  assert.equal(settings.rocket, undefined);
  storage.setItem(SETTINGS_KEY, 'not json');
  assert.deepEqual(loadSettings(storage), defaultSettings());
});

test('the language is saved, and a bad language is removed', () => {
  const storage = memoryStorage();
  assert.equal(loadSettings(storage).language, null);
  saveSettings(storage, { ...defaultSettings(), language: 'vi' });
  assert.equal(loadSettings(storage).language, 'vi');
  storage.setItem(SETTINGS_KEY, '{"language": "klingon"}');
  assert.equal(loadSettings(storage).language, null);
});
