import crypto from 'crypto';
import { pool } from '../db.js';

/**
 * Un email n'est pas sensible à la casse pour un humain qui le tape
 * ("Jean@Gmail.com" et "jean@gmail.com" désignent la même boîte), mais
 * Postgres compare les chaînes EXACTEMENT telles quelles par défaut. Sans
 * cette normalisation, quelqu'un qui s'inscrit avec une majuscule puis se
 * reconnecte sans (ou l'inverse) obtient "email ou mot de passe
 * incorrect" — pas une erreur de mot de passe, un email qui ne "matche"
 * plus. On normalise à l'écriture ET à la lecture, jamais l'un sans
 * l'autre, pour que les deux se rencontrent toujours au même format.
 */
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Le premier compte jamais créé devient automatiquement admin — sans ça,
 * personne ne pourrait jamais accéder au panel administrateur sans
 * modifier la base de données à la main. Tous les comptes suivants sont
 * 'user' par défaut.
 */
export async function createUser(email, passwordHash, name) {
  const normalizedEmail = normalizeEmail(email);

  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  const isFirstUser = countRows[0].count === 0;
  const role = isFirstUser ? 'admin' : 'user';

  const { rows } = await pool.query(
    `INSERT INTO users (email, "passwordHash", role, "createdAt", name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [normalizedEmail, passwordHash, role, Date.now(), name]
  );

  return { id: rows[0].id, email: normalizedEmail, role, name };
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Ne renvoie JAMAIS passwordHash — utilisé pour les listes/profils publics. */
export async function listUsers() {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, "createdAt", "avatarUrl" FROM users ORDER BY "createdAt" DESC'
  );
  return rows;
}

export async function updateUserRole(id, role) {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
}

/**
 * Met à jour uniquement les champs fournis (les autres gardent leur
 * valeur actuelle) — on relit d'abord la ligne existante puis on fusionne,
 * plutôt que de construire une requête SQL dont la liste de colonnes
 * change selon ce qui a été envoyé. Une seule forme de requête, toujours
 * la même, plus simple à relire et à déboguer que du SQL généré
 * dynamiquement.
 */
export async function updateProfile(id, { name, bio, avatarUrl }) {
  const current = await findUserById(id);
  if (!current) return null;

  const merged = {
    name: name !== undefined ? name : current.name,
    bio: bio !== undefined ? bio : current.bio,
    avatarUrl: avatarUrl !== undefined ? avatarUrl : current.avatarUrl,
  };

  await pool.query(
    'UPDATE users SET name = $1, bio = $2, "avatarUrl" = $3 WHERE id = $4',
    [merged.name, merged.bio, merged.avatarUrl, id]
  );

  return { ...current, ...merged };
}

/**
 * Génère un jeton de réinitialisation à usage unique, valable 1h, et
 * l'enregistre sur le compte. crypto.randomBytes (et non Math.random) :
 * c'est un générateur cryptographiquement sûr — le genre de détail qui ne
 * change rien en usage normal, mais qui compte précisément pour un jeton
 * qui donne accès à un compte s'il est deviné.
 *
 * Ne fait AUCUNE distinction entre "email inconnu" et "email connu" pour
 * l'appelant (voir src/routes/auth.js) — la fonction renvoie toujours un
 * résultat, jamais une erreur, pour ne jamais révéler si une adresse est
 * inscrite ou non.
 */
export async function createPasswordResetToken(email) {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1h

  await pool.query(
    'UPDATE users SET "resetToken" = $1, "resetTokenExpiresAt" = $2 WHERE id = $3',
    [token, expiresAt, user.id]
  );

  return { token, user };
}

export async function findUserByResetToken(token) {
  const { rows } = await pool.query('SELECT * FROM users WHERE "resetToken" = $1', [token]);
  const user = rows[0];
  if (!user) return null;
  if (!user.resetTokenExpiresAt || Date.now() > user.resetTokenExpiresAt) return null; // jeton expiré
  return user;
}

/**
 * Change le mot de passe ET efface le jeton dans la MÊME opération — un
 * jeton de réinitialisation ne doit jamais pouvoir resservir une seconde
 * fois, que ce soit par la personne elle-même ou par quelqu'un qui
 * l'aurait intercepté.
 */
export async function resetPassword(userId, newPasswordHash) {
  await pool.query(
    'UPDATE users SET "passwordHash" = $1, "resetToken" = NULL, "resetTokenExpiresAt" = NULL WHERE id = $2',
    [newPasswordHash, userId]
  );
}
