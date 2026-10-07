import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('navigation loads beside a page script that declares isAdmin', () => {
  const listeners = [];
  const context = vm.createContext({
    document: {
      addEventListener: (...args) => listeners.push(args),
    },
  });

  vm.runInContext('let isAdmin = false;', context);
  const navScript = readFileSync(new URL('../public/js/nav.js', import.meta.url), 'utf8');

  assert.doesNotThrow(() => vm.runInContext(navScript, context));
  assert.ok(listeners.some(([eventName]) => eventName === 'DOMContentLoaded'));
});
