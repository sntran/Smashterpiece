// The settings of the game, for example the settings for accessibility.
// This module does not use three.js or the DOM.

export const SETTINGS_KEY = 'smashterpiece.settings';

// The default values. `reduceMotion` and `contrast` also follow the
// settings of the device (see defaultSettings).
export const DEFAULTS = {
  speak: false,
  easyControls: false,
  easyMode: false,
  reduceMotion: false,
  contrast: false,
  bigButtons: false,
  music: true,
  vibrate: true,
  showFps: false,
  // null: use the language of the device.
  language: null,
};

// The languages that a player can choose.
const LANGUAGE_CODES = ['en', 'vi'];

export const SETTING_NAMES = Object.keys(DEFAULTS);
// The settings that are on or off.
export const SWITCH_NAMES = SETTING_NAMES.filter((name) => typeof DEFAULTS[name] === 'boolean');

// The defaults for this device.
export function defaultSettings(device = {}) {
  return { ...DEFAULTS, reduceMotion: !!device.reduceMotion, contrast: !!device.contrast };
}

// Load the settings. A setting that is missing or bad gets its default.
export function loadSettings(storage, device = {}) {
  const settings = defaultSettings(device);
  try {
    const data = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}');
    for (const name of SWITCH_NAMES) {
      if (typeof data?.[name] === 'boolean') settings[name] = data[name];
    }
    if (LANGUAGE_CODES.includes(data?.language)) settings.language = data.language;
  } catch {
    // Bad data gives the defaults.
  }
  return settings;
}

export function saveSettings(storage, settings) {
  const clean = {};
  for (const name of SWITCH_NAMES) clean[name] = !!settings[name];
  clean.language = LANGUAGE_CODES.includes(settings.language) ? settings.language : null;
  storage.setItem(SETTINGS_KEY, JSON.stringify(clean));
}
