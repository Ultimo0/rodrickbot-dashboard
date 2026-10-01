import { pool } from '../db.js';

/** Longueur maximale d'un commentaire (même convention que BIO_MAX_LENGTH dans profile.js). */
export const COMMENT_MAX_LENGTH = 500;

const SELECT_BASE = `
  SELECT post_comments.*, users.name AS "authorName", users."avatarUrl" AS "authorAvatarUrl"
  FROM post_comments
  JOIN users ON users.id = post_comments."authorId"
`;

export async function listComments(postId, { limit = 50, beforeId = null } = {}) {
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `${SELECT_BASE}
       WHERE post_comments."postId" = $1 AND ($2::integer IS NULL OR post_comments.id < $2)
       ORDER BY post_comments.id DESC
       LIMIT $3`,
      [postId, beforeId, limit + 1]
    ),
    pool.query('SELECT COUNT(*)::int AS count FROM post_comments WHERE "postId" = $1', [postId]),
  ]);
  const hasMore = rows.length > limit;
  const comments = rows.slice(0, limit).reverse();
  return {
    comments,
    totalCount: countRows[0].count,
    hasMore,
    nextCursor: comments[0]?.id ?? null,
  };
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
