import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);

function listFiles(dir) {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(`${dir}${entry.name}/`) : [`${dir}${entry.name}`],
  );
}

test('the service worker keeps all game files', () => {
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  const files = [...listFiles('src/'), ...listFiles('icons/'), 'index.html', 'style.css', 'manifest.webmanifest'];
  for (const file of files) assert.ok(sw.includes(`'./${file}'`), `sw.js does not keep ${file}`);
});

test('the manifest uses relative paths and has the icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `${icon.src} is not relative`);
    readFileSync(new URL(icon.src, root));
  }
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
});

test('the deploy can write the version into the service worker', () => {
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  // The deploy workflow replaces exactly this line.
  assert.match(sw, /^const VERSION = 'dev';$/m);
  const workflow = readFileSync(new URL('.github/workflows/pages.yml', root), 'utf8');
  assert.ok(workflow.includes("s/^const VERSION = 'dev';$/"));
});
