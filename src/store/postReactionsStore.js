import { pool } from '../db.js';

/** Émojis autorisés — liste fermée pour garder l'UI simple et cohérente. */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/**
 * Résumé des réactions d'un post : le total par émoji, plus la réaction
 * de l'utilisateur courant s'il y en a une (personnalisation légère,
 * sans exposer la liste des autres utilisateurs ayant réagi).
 */
export async function getReactionsSummary(postId, userId) {
  const { rows } = await pool.query(
    `SELECT emoji, COUNT(*)::int AS count
     FROM post_reactions
     WHERE "postId" = $1
     GROUP BY emoji`,
    [postId]
  );
  const counts = {};
  for (const row of rows) counts[row.emoji] = row.count;

  let myReaction = null;
  if (userId) {
    const { rows: mine } = await pool.query(
      'SELECT emoji FROM post_reactions WHERE "postId" = $1 AND "userId" = $2',
      [postId, userId]
    );
    myReaction = mine[0]?.emoji || null;
  }

  return { counts, myReaction };
}

/**
 * Bascule la réaction d'un utilisateur sur un post :
 * - pas de réaction existante -> on l'ajoute
 * - même émoji déjà posé -> on la retire (toggle off)
 * - émoji différent déjà posé -> on la remplace
 * Un utilisateur ne peut avoir qu'une seule réaction par post (clé primaire
 * composite postId/userId dans le schéma).
 */
export async function setReaction(postId, userId, emoji) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // This key also serializes the first reaction, when there is no row to
    // SELECT ... FOR UPDATE yet. The lock is released automatically at commit.
    await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', [postId, userId]);
    const { rows: existing } = await client.query(
      'SELECT emoji FROM post_reactions WHERE "postId" = $1 AND "userId" = $2',
      [postId, userId]
    );

    if (existing[0]?.emoji === emoji) {
      await client.query('DELETE FROM post_reactions WHERE "postId" = $1 AND "userId" = $2', [postId, userId]);
    } else if (existing.length) {
      await client.query(
        'UPDATE post_reactions SET emoji = $1, "createdAt" = $2 WHERE "postId" = $3 AND "userId" = $4',
        [emoji, Date.now(), postId, userId]
      );
    } else {
      await client.query(
        'INSERT INTO post_reactions ("postId", "userId", emoji, "createdAt") VALUES ($1, $2, $3, $4)',
        [postId, userId, emoji, Date.now()]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return getReactionsSummary(postId, userId);
}
