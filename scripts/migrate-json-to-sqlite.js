/**
 * migrate-json-to-sqlite.js
 * ------------------------------------------------------------------
 * À lancer UNE SEULE FOIS après avoir mis à jour vers la Phase 3, pour ne
 * pas perdre les données déjà accumulées dans data/instances.json et
 * data/releases.json (l'ancien système de stockage).
 *
 * Usage : npm run migrate
 * ------------------------------------------------------------------
 */

import { readFileSync, existsSync } from 'fs';
import { DATA_FILE, RELEASES_FILE } from '../src/config.js';
import { saveInstances } from '../src/store/instancesStore.js';
import { addRelease } from '../src/store/releasesStore.js';

console.log('Migration des anciennes données JSON vers SQLite...\n');

if (existsSync(DATA_FILE)) {
  const instances = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  saveInstances(instances);
  console.log(`✅ ${Object.keys(instances).length} instance(s) migrée(s) depuis data/instances.json`);
} else {
  console.log('ℹ️  Pas de data/instances.json trouvé — rien à migrer pour les instances.');
}

if (existsSync(RELEASES_FILE)) {
  const releases = JSON.parse(readFileSync(RELEASES_FILE, 'utf-8'));
  for (const release of releases) addRelease(release);
  console.log(`✅ ${releases.length} release(s) migrée(s) depuis data/releases.json`);
} else {
  console.log('ℹ️  Pas de data/releases.json trouvé — rien à migrer pour les releases.');
}

console.log('\nMigration terminée. Les anciens fichiers data/*.json ne sont plus utilisés');
console.log('par le serveur — tu peux les garder comme sauvegarde ou les supprimer, comme tu veux.');
