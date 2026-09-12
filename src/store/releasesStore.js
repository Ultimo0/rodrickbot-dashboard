import { pool } from '../db.js';

export async function loadReleases() {
  const { rows } = await pool.query('SELECT * FROM releases ORDER BY date DESC');
  return rows;
}

export async function addRelease(release) {
  await pool.query(
    `INSERT INTO releases (version, date, changelog, "downloadUrl")
     VALUES ($1, $2, $3, $4)`,
    [release.version, release.date, release.changelog || '', release.downloadUrl || null]
  );
}

export async function getLatestRelease() {
  const releases = await loadReleases();
  return releases[0] || null;
}
