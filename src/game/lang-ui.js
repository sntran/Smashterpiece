// The language of the game. These methods belong to the Game class (see
// main.js).
//
// The words are in src/core/i18n.js. In index.html, an element gets its
// words from these attributes:
//   data-i18n        the text of the element
//   data-i18n-html   the text, with {name} as a name in its own language
//   data-i18n-aria   the aria-label of the element
//   data-i18n-label  the small name under the picture of a tile

import { translate, pickLanguage, LANGUAGES, LANGUAGE_NAMES, SPEECH_LANG } from '../core/i18n.js';
import { saveSettings } from '../core/settings.js';
import { hardnessOf } from '../core/stones.js';
import { $, $$ } from './dom.js';

// The names in the dedication. They stay in Vietnamese in all languages.
const NAMES = { son: 'Trần Nhật An Nhiên', short: 'An Nhiên', dad: 'Trần Nguyễn Sơn' };

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export const langMethods = {
  t(key, params) {
    return translate(this.lang ?? 'en', key, params);
  },

  initLanguage() {
    this.lang = pickLanguage(this.settings.language, navigator.languages ?? [navigator.language]);
    const box = $('#languages');
    box.innerHTML = '';
    for (const code of LANGUAGES) {
      const button = document.createElement('button');
      button.className = 'language';
      button.dataset.language = code;
      button.lang = code;
      button.textContent = LANGUAGE_NAMES[code];
      box.appendChild(button);
    }
    this.applyLanguage();
  },

  setLanguage(code) {
    this.lang = code;
    this.settings.language = code;
    try {
      saveSettings(this.storage, this.settings);
    } catch {
      // The storage is full. The language stays for this visit.
    }
    this.applyLanguage();
    this.announce(LANGUAGE_NAMES[code]);
  },

  applyLanguage() {
    document.documentElement.lang = this.lang;
    for (const el of $$('[data-language]')) el.setAttribute('aria-pressed', String(el.dataset.language === this.lang));
    const nameFor = (el) => NAMES[el.dataset.name ?? 'son'];
    for (const el of $$('[data-i18n]')) el.textContent = this.t(el.dataset.i18n);
    for (const el of $$('[data-i18n-html]')) {
      const name = `<span class="${el.dataset.nameClass ?? ''}" lang="vi">${escapeHtml(nameFor(el))}</span>`;
      el.innerHTML = escapeHtml(this.t(el.dataset.i18nHtml)).replace('{name}', name);
    }
    for (const el of $$('[data-i18n-aria]')) el.setAttribute('aria-label', this.t(el.dataset.i18nAria, { name: nameFor(el) }));
    for (const el of $$('[data-i18n-label]')) {
      const label = $('.label', el);
      if (label) label.textContent = this.t(el.dataset.i18nLabel);
    }
    // The buttons that the game makes.
    for (const el of $$('#shape-tiles [data-shape]')) {
      const name = this.t(`shape.${el.dataset.shape}`);
      el.setAttribute('aria-label', name);
      $('.label', el).textContent = name;
    }
    const abc = $('#shape-tiles [data-action="letters"]');
    abc.setAttribute('aria-label', this.t('pick.letters'));
    $('.label', abc).textContent = this.t('pick.letters');
    for (const el of $$('#letter-tiles [data-shape]')) {
      el.setAttribute('aria-label', this.t('pick.letter', { letter: el.dataset.shape.slice(7) }));
    }
    for (const el of $$('#stone-tiles [data-stone]')) {
      const name = this.t(`stone.${el.dataset.stone}`);
      el.setAttribute('aria-label', this.t('pick.hits', { name, count: hardnessOf(el.dataset.stone) }));
      $('.label', el).textContent = name;
    }
    this.buildSettingsPanel();
    this.applySettings();
    if (this.tool) this.buildToolOptions();
    if (this.screen === 'treasures') this.openTreasures();
  },

  // The speech of the device, in the language of the game.
  speechLang() {
    return SPEECH_LANG[this.lang] ?? 'en-US';
  },

  // A voice for the language, when the device has one.
  speechVoice() {
    const synth = window.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return null;
    const lang = this.speechLang().toLowerCase();
    const voices = synth.getVoices();
    return voices.find((v) => v.lang.toLowerCase() === lang)
      ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ?? null;
  },
};
