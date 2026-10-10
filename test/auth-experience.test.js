import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loginHtml = readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
const registerHtml = readFileSync(new URL('../public/register.html', import.meta.url), 'utf8');
const assistantScript = readFileSync(new URL('../public/js/auth-assistant.js', import.meta.url), 'utf8');
const loginScript = readFileSync(new URL('../public/js/login.js', import.meta.url), 'utf8');
const registerScript = readFileSync(new URL('../public/js/register.js', import.meta.url), 'utf8');

test('login and registration offer the same animated assistant foundation', () => {
  for (const html of [loginHtml, registerHtml]) {
    assert.match(html, /class="auth-stage" data-auth-mode="(?:login|register)"/);
    assert.match(html, /class="auth-robot"/);
    assert.match(html, /id="assistantMessage"[^>]*aria-live="polite"/);
    assert.match(html, /<script src="js\/auth-assistant\.js"><\/script>/);
    assert.match(html, /class="field-state" aria-hidden="true"/);
    assert.match(html, /role="alert" aria-live="assertive"/);
  }
  assert.match(loginHtml, /data-auth-transition>S'inscrire/);
  assert.match(registerHtml, /data-auth-transition>Se connecter/);
  assert.match(registerHtml, /id="passwordStrength" class="password-strength"/);
});

test('assistant and password controls expose the expected reactions', () => {
  assert.match(assistantScript, /auth:password-visibility/);
  assert.match(assistantScript, /passwordScore/);
  assert.match(assistantScript, /is-password-visible/);
  assert.match(assistantScript, /data-auth-transition/);
  for (const script of [loginScript, registerScript]) {
    assert.match(script, /new CustomEvent\('auth:password-visibility'/);
    assert.match(script, /window\.authAssistant\?\.error/);
    assert.match(script, /form\.checkValidity\(\)/);
  }
});
