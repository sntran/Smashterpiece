import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, LANGUAGES, translate, pickLanguage, placeholders } from '../src/core/i18n.js';
import { STONE_NAMES } from '../src/core/stones.js';
import { PICTURE_SHAPES } from '../src/core/shapes.js';
import { TREASURE_IDS } from '../src/core/treasures.js';
import { BADGE_IDS } from '../src/core/badges.js';
import { STICKER_TYPES } from '../src/core/decorate.js';
import { SETTING_NAMES } from '../src/core/settings.js';

test('each language has the same keys and the same placeholders', () => {
  const keys = Object.keys(STRINGS.en).sort();
  for (const lang of LANGUAGES) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), keys, `the keys of ${lang}`);
    for (const key of keys) {
      assert.deepEqual(placeholders(STRINGS[lang][key]), placeholders(STRINGS.en[key]), `${lang} ${key}`);
      assert.ok(STRINGS[lang][key].trim().length > 0, `${lang} ${key} is empty`);
    }
  }
});

test('each game item has a name in each language', () => {
  const keys = [
    ...STONE_NAMES.map((n) => `stone.${n}`),
    ...PICTURE_SHAPES.map((n) => `shape.${n}`),
    ...TREASURE_IDS.map((n) => `treasure.${n}`),
    ...BADGE_IDS.flatMap((n) => [`badge.${n}`, `badge.${n}.hint`]),
    ...STICKER_TYPES.map((n) => `sticker.${n}`),
    ...SETTING_NAMES.filter((n) => n !== 'language').flatMap((n) => [`setting.${n}`, `setting.${n}.help`]),
  ];
  for (const lang of LANGUAGES) {
    for (const key of keys) assert.ok(key in STRINGS[lang], `${lang} has no ${key}`);
  }
});

test('translate fills the placeholders and picks the number form', () => {
  assert.equal(translate('en', 'news.found', { name: 'Gem' }), 'You found: Gem!');
  assert.equal(translate('vi', 'news.found', { name: 'Viên ngọc' }), 'Bạn tìm thấy: Viên ngọc!');
  assert.equal(translate('en', 'news.stars', { count: 1 }), '1 star!');
  assert.equal(translate('en', 'news.stars', { count: 2 }), '2 stars!');
  assert.equal(translate('en', 'backup.statues', { count: 0 }), '0 new statues');
});

test('an unknown key or language does not give an empty text', () => {
  assert.equal(translate('fr', 'menu.carve'), 'Carve');
  assert.equal(translate('vi', 'no.such.key'), 'no.such.key');
  assert.equal(translate('en', 'menu.for'), 'For {name}');
});

test('the language comes from the choice, then from the device', () => {
  assert.equal(pickLanguage('vi', ['en-US']), 'vi');
  assert.equal(pickLanguage(null, ['vi-VN', 'en']), 'vi');
  assert.equal(pickLanguage(null, ['fr-FR', 'en-GB']), 'en');
  assert.equal(pickLanguage(null, ['fr-FR']), 'en');
  assert.equal(pickLanguage('xx', []), 'en');
});
