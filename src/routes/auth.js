import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  createUser,
  findUserByEmail,
  findUserById,
  createPasswordResetToken,
  findUserByResetToken,
  resetPassword,
} from '../store/usersStore.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { loginLimiter, registerLimiter, forgotPasswordLimiter } from '../middleware/rateLimit.js';
import { sendPasswordResetEmail } from '../email.js';
import { ah } from '../utils/asyncHandler.js';

export const authRouter = Router();

// Coût du hachage : plus ce nombre est élevé, plus c'est lent à calculer
// (volontairement — ça rend une attaque par force brute impraticable),
// mais aussi plus lent pour l'utilisateur légitime qui se connecte. 10
// est un bon compromis standard, largement utilisé en production.
const BCRYPT_COST = 10;

// Volontairement permissif (juste "quelque chose@quelque chose.quelque
// chose") plutôt qu'une regex RFC 5322 complète — la vraie validation
// d'un email, c'est de vérifier qu'il reçoit effectivement les emails
// envoyés dessus, pas une regex plus stricte qui rejetterait des adresses
// valides mais inhabituelles.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/auth/register', registerLimiter, ah(async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }
  if (await findUserByEmail(email)) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await createUser(email, passwordHash, name);

  req.session.userId = user.id;

  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl || null } });
}));

authRouter.post('/auth/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = req.body || {};

  const user = await findUserByEmail(email);
  // Message volontairement identique que l'email n'existe pas OU que le
  // mot de passe soit faux — ne jamais révéler laquelle des deux est
  // fausse, ça aiderait quelqu'un à deviner les emails déjà inscrits.
  const invalidMessage = { error: 'Email ou mot de passe incorrect.' };

  if (!user) return res.status(401).json(invalidMessage);

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return res.status(401).json(invalidMessage);

  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl || null } });
}));

authRouter.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Utilisé par le front pour savoir, à chaque chargement de page, si la
// personne est déjà connectée (et afficher son profil ou un lien
// "Connexion" selon le cas).
authRouter.get('/auth/me', requireAuth, ah(async (req, res) => {
  const user = await findUserById(req.session.userId);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || null,
  });
}));

/**
 * Répond TOUJOURS { ok: true }, que l'email existe ou non — c'est
 * volontaire (voir createPasswordResetToken dans usersStore.js) : si la
 * réponse changeait selon que l'adresse est inscrite, n'importe qui
 * pourrait s'en servir pour vérifier quels emails ont un compte sur le
 * Hub, un par un.
 */
authRouter.post('/auth/forgot-password', forgotPasswordLimiter, ah(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  const result = await createPasswordResetToken(email);
  if (result) {
    await sendPasswordResetEmail(result.user.email, result.token);
  }

  res.json({ ok: true });
}));

authRouter.post('/auth/reset-password', ah(async (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ error: 'Jeton et nouveau mot de passe requis.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }

  const user = await findUserByResetToken(token);
  if (!user) {
    return res.status(400).json({ error: 'Ce lien de réinitialisation est invalide ou a expiré.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await resetPassword(user.id, passwordHash);

  res.json({ ok: true });
}));
