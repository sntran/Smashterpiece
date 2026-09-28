// The settings of the game, for example the settings for accessibility.
// This module does not use three.js or the DOM.

export const SETTINGS_KEY = 'smashterpiece.settings';

// The default values. `reduceMotion` and `contrast` also follow the
// settings of the device (see defaultSettings).
export const DEFAULTS = {
  speak: true,
  easyControls: false,
  easyMode: false,
  reduceMotion: false,
  contrast: false,
  bigButtons: false,
  music: true,
  vibrate: true,
  showFps: false,
};

export const SETTING_NAMES = Object.keys(DEFAULTS);

// The defaults for this device.
export function defaultSettings(device = {}) {
  return { ...DEFAULTS, reduceMotion: !!device.reduceMotion, contrast: !!device.contrast };
}

// Load the settings. A setting that is missing or bad gets its default.
export function loadSettings(storage, device = {}) {
  const settings = defaultSettings(device);
  try {
    const data = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}');
    for (const name of SETTING_NAMES) {
      if (typeof data?.[name] === 'boolean') settings[name] = data[name];
    }
  } catch {
    // Bad data gives the defaults.
  }
  return settings;
}

export function saveSettings(storage, settings) {
  const clean = {};
  for (const name of SETTING_NAMES) clean[name] = !!settings[name];
  storage.setItem(SETTINGS_KEY, JSON.stringify(clean));
}
