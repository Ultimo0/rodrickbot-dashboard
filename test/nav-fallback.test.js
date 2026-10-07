import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const expectedLinks = [
  ['index.html', 'Accueil'],
  ['dashboard.html', 'Instances'],
  ['releases.html', 'Versions'],
  ['commands.html', 'Commandes'],
  ['community.html', 'Communauté'],
  ['stats.html', 'Statistiques'],
];

test('every page keeps static navigation links as a JavaScript fallback', () => {
  const pages = readdirSync(publicDir)
    .filter((file) => file.endsWith('.html'))
    .map((file) => ({ file, html: readFileSync(path.join(publicDir, file), 'utf8') }))
    .filter(({ html }) => html.includes('id="hubNavLinks"'));

  assert.ok(pages.length > 0, 'expected pages with the shared navigation container');
  for (const { file, html } of pages) {
    const nav = html.match(/<div class="hub-nav-links" id="hubNavLinks">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(nav, `${file} should have static navigation content`);
    for (const [href, label] of expectedLinks) {
      assert.match(nav, new RegExp(`<a href="${href}"[^>]*>${label}<\\/a>`), `${file} should link to ${label}`);
    }
    assert.match(nav, /href="dashboard\.html" data-admin-only-link hidden/, `${file} should hide Instances by default`);
  }
});
