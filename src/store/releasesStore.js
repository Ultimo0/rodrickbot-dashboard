import { pool } from '../db.js';

export async function loadReleases() {
  const { rows } = await pool.query('SELECT * FROM releases ORDER BY date DESC');
  return rows;
}

export async function addRelease(release) {
  const { rows } = await pool.query(
    `INSERT INTO releases (version, date, changelog, "downloadUrl", "createdAt")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [release.version, release.date, release.changelog || '', release.downloadUrl || null, Date.now()]
  );
  return rows[0];
}

export async function getReleaseById(id) {
  const { rows } = await pool.query('SELECT * FROM releases WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateRelease(id, { version, date, changelog, downloadUrl }) {
  const current = await getReleaseById(id);
  if (!current) return null;

  const merged = {
    version: version !== undefined ? version : current.version,
    date: date !== undefined ? date : current.date,
    changelog: changelog !== undefined ? changelog : current.changelog,
    downloadUrl: downloadUrl !== undefined ? downloadUrl : current.downloadUrl,
  };

  await pool.query(
    'UPDATE releases SET version = $1, date = $2, changelog = $3, "downloadUrl" = $4 WHERE id = $5',
    [merged.version, merged.date, merged.changelog, merged.downloadUrl, id]
  );

  return { ...current, ...merged };
}

/**
 * Accepte un ou plusieurs id à la fois (voir "= ANY($1)") — la suppression
 * groupée depuis releases.html envoie un tableau, la suppression d'une
 * seule version envoie un tableau à un seul élément : même fonction pour
 * les deux cas, pas besoin d'une variante séparée.
 */
export async function deleteReleases(ids) {
  const { rowCount } = await pool.query('DELETE FROM releases WHERE id = ANY($1)', [ids]);
  return rowCount;
}

export async function getLatestRelease() {
  const releases = await loadReleases();
  return releases[0] || null;
}

/** Utilisé pour les badges de nouveauté (voir src/routes/notifications.js). */
export async function getLatestTimestamp() {
  const { rows } = await pool.query('SELECT MAX("createdAt")::bigint AS latest FROM releases');
  return rows[0].latest || 0;
}
