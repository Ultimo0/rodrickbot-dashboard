import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const authNav = readFileSync(new URL('../public/js/auth-nav.js', import.meta.url), 'utf8');

test('home page offers signup only to visitors who are not logged in', () => {
  assert.match(homeHtml, /<a class="landing-button landing-button-primary" href="register\.html" data-logged-out-only hidden>[\s\S]*?S’inscrire[\s\S]*?<\/a>/);
  assert.match(authNav, /document\.querySelectorAll\('\[data-logged-out-only\]'\)/);
  assert.match(authNav, /setGuestLinksVisible\(false\)/);
  assert.match(authNav, /setGuestLinksVisible\(true\)/);
});
