import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAVORITES_FILTER,
  filterCommands,
  filterInstances,
  formatCommandUsage,
  normalizeSearch,
} from '../public/js/ui-utils.js';

test('normalise accents and strips a command prefix from searches', () => {
  assert.equal(normalizeSearch('!téléchargement'), 'telechargement');
});

test('filters instances by status and searchable identity fields', () => {
  const instances = [
    { instanceId: 'alpha', ownerName: 'Njaka', online: true, enabled: true },
    { instanceId: 'beta', ownerName: 'Aline', online: false, enabled: true },
    { instanceId: 'gamma', ownerName: 'Marc', online: false, enabled: false },
  ];

  assert.deepEqual(filterInstances(instances, { status: 'online' }).map((item) => item.instanceId), ['alpha']);
  assert.deepEqual(filterInstances(instances, { status: 'disabled' }).map((item) => item.instanceId), ['gamma']);
  assert.deepEqual(filterInstances(instances, { query: 'njaka' }).map((item) => item.instanceId), ['alpha']);
});

test('searches commands by alias, description, syntax, and category', () => {
  const commands = [
    { name: 'youtube', aliases: ['yt'], category: 'Téléchargement', description: 'Télécharge une vidéo', syntax: '{prefix}youtube <lien>' },
    { name: 'ping', aliases: [], category: 'Général', description: 'Teste la réponse', syntax: '{prefix}ping' },
  ];

  assert.deepEqual(filterCommands(commands, { query: '!yt' }).map((item) => item.name), ['youtube']);
  assert.deepEqual(filterCommands(commands, { query: 'telecharge' }).map((item) => item.name), ['youtube']);
  assert.deepEqual(filterCommands(commands, { category: 'Général' }).map((item) => item.name), ['ping']);
});

test('filters favorites and formats the usage with the standard prefix', () => {
  const command = { name: 'weather', aliases: [], category: 'Outils', description: '', syntax: '{prefix}meteo <ville>' };
  assert.deepEqual(filterCommands([command], {
    category: FAVORITES_FILTER,
    favorites: new Set(['weather']),
  }), [command]);
  assert.equal(formatCommandUsage(command), '!meteo <ville>');
  assert.equal(formatCommandUsage({ name: 'ping' }), '!ping');
});
