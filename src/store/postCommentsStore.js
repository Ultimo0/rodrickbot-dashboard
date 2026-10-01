import { pool } from '../db.js';

/** Longueur maximale d'un commentaire (même convention que BIO_MAX_LENGTH dans profile.js). */
export const COMMENT_MAX_LENGTH = 500;

const SELECT_BASE = `
  SELECT post_comments.*, users.name AS "authorName", users."avatarUrl" AS "authorAvatarUrl"
  FROM post_comments
  JOIN users ON users.id = post_comments."authorId"
`;

export async function listComments(postId) {
  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE post_comments."postId" = $1 ORDER BY post_comments."createdAt" ASC`,
    [postId]
  );
  return rows;
}

export async function getComment(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE post_comments.id = $1`, [id]);
  return rows[0] || null;
}

export async function createComment({ postId, authorId, content }) {
  const { rows } = await pool.query(
    `INSERT INTO post_comments ("postId", "authorId", content, "createdAt")
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [postId, authorId, content, Date.now()]
  );
  return getComment(rows[0].id);
}

export async function deleteComment(id) {
  await pool.query('DELETE FROM post_comments WHERE id = $1', [id]);
}
