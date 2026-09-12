import { db } from '../db.js';

const selectAll = db.prepare('SELECT * FROM releases ORDER BY date DESC');
const insert = db.prepare('INSERT INTO releases (version, date, changelog, downloadUrl) VALUES (?, ?, ?, ?)');

// Remarque : le tri par date se fait maintenant directement en SQL
// (ORDER BY date DESC) au lieu d'un .sort() en JavaScript — la base de
// données s'en charge, pas nous.
export function loadReleases() {
  return selectAll.all();
}

export function addRelease(release) {
  insert.run(release.version, release.date, release.changelog || '', release.downloadUrl || null);
}

export function getLatestRelease() {
  return loadReleases()[0] || null;
}
