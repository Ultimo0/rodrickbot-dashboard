import { pool } from '../db.js';

/**
 * Le premier compte jamais créé devient automatiquement admin — sans ça,
 * personne ne pourrait jamais accéder au panel administrateur sans
 * modifier la base de données à la main. Tous les comptes suivants sont
 * 'user' par défaut.
 */
export async function createUser(email, passwordHash, name) {
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  const isFirstUser = countRows[0].count === 0;
  const role = isFirstUser ? 'admin' : 'user';

  const { rows } = await pool.query(
    `INSERT INTO users (email, "passwordHash", role, "createdAt", name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [email, passwordHash, role, Date.now(), name]
  );

  return { id: rows[0].id, email, role, name };
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Ne renvoie JAMAIS passwordHash — utilisé pour les listes/profils publics. */
export async function listUsers() {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, "createdAt" FROM users ORDER BY "createdAt" DESC'
  );
  return rows;
}

export async function updateUserRole(id, role) {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
}
