import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAVORITES_FILTER,
  activeFeatureCounts,
  filterCommands,
  filterInstances,
  formatCommandUsage,
  formatDateTime,
  normalizeSearch,
  ytDlpRefreshLabel,
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

test('summarises active group features safely and with readable labels', () => {
  assert.deepEqual(activeFeatureCounts({ antilink: 3, antistatut: 0, customFeature: 2 }), [
    { name: 'antilink', label: 'Anti-lien', count: 3 },
    { name: 'customFeature', label: 'custom Feature', count: 2 },
  ]);
  assert.equal(activeFeatureCounts(null), null);
  assert.deepEqual(activeFeatureCounts({ antilink: -1, guardian: '5' }), []);
});

test('formats instance timestamps and yt-dlp refresh states', () => {
  assert.equal(formatDateTime(null), 'Non communiqué');
  assert.match(formatDateTime(0), /1970/);
  assert.equal(ytDlpRefreshLabel(true), 'Actualisation réussie');
  assert.equal(ytDlpRefreshLabel(false), 'Échec de la dernière actualisation');
  assert.equal(ytDlpRefreshLabel(null), 'État non communiqué par cette version');
});
