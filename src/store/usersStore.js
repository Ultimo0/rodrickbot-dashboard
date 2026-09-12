import { db } from '../db.js';

const insert = db.prepare(`
  INSERT INTO users (email, passwordHash, role, createdAt, name)
  VALUES (?, ?, ?, ?, ?)
`);
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findById = db.prepare('SELECT * FROM users WHERE id = ?');
const selectAll = db.prepare('SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt DESC');
const updateRole = db.prepare('UPDATE users SET role = ? WHERE id = ?');

/**
 * Le premier compte jamais créé devient automatiquement admin — sans ça,
 * personne ne pourrait jamais accéder au panel administrateur (Phase 5)
 * sans modifier la base de données à la main. Tous les comptes suivants
 * sont 'user' par défaut.
 */
export function createUser(email, passwordHash, name) {
  const isFirstUser = selectAll.all().length === 0;
  const role = isFirstUser ? 'admin' : 'user';
  const result = insert.run(email, passwordHash, role, Date.now(), name);
  return { id: result.lastInsertRowid, email, role, name };
}

export function findUserByEmail(email) {
  return findByEmail.get(email) || null;
}

export function findUserById(id) {
  return findById.get(id) || null;
}

/** Ne renvoie JAMAIS passwordHash — utilisé pour les listes/profils publics. */
export function listUsers() {
  return selectAll.all();
}

export function updateUserRole(id, role) {
  updateRole.run(role, id);
}
