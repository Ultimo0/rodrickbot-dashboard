import { pool } from '../db.js';

export const SECTIONS = ['releases', 'community'];

/** Renvoie { releases: <timestamp|0>, community: <timestamp|0> } pour ce compte. */
export async function getSeenMap(userId) {
  const { rows } = await pool.query('SELECT section, "lastSeenAt" FROM user_seen WHERE "userId" = $1', [userId]);

  const map = { releases: 0, community: 0 };
  for (const row of rows) map[row.section] = row.lastSeenAt;
  return map;
}

export async function markSeen(userId, section) {
  if (!SECTIONS.includes(section)) throw new Error(`Section inconnue : ${section}`);

  await pool.query(
    `INSERT INTO user_seen ("userId", section, "lastSeenAt")
     VALUES ($1, $2, $3)
     ON CONFLICT ("userId", section) DO UPDATE SET "lastSeenAt" = $3`,
    [userId, section, Date.now()]
  );
}
