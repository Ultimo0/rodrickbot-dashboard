import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, findUserById } from '../store/usersStore.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();

// Coût du hachage : plus ce nombre est élevé, plus c'est lent à calculer
// (volontairement — ça rend une attaque par force brute impraticable),
// mais aussi plus lent pour l'utilisateur légitime qui se connecte. 10
// est un bon compromis standard, largement utilisé en production.
const BCRYPT_COST = 10;

authRouter.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = createUser(email, passwordHash, name);

  req.session.userId = user.id;

  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  const user = findUserByEmail(email);
  // Message volontairement identique que l'email n'existe pas OU que le
  // mot de passe soit faux — ne jamais révéler laquelle des deux est
  // fausse, ça aiderait quelqu'un à deviner les emails déjà inscrits.
  const invalidMessage = { error: 'Email ou mot de passe incorrect.' };

  if (!user) return res.status(401).json(invalidMessage);

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return res.status(401).json(invalidMessage);

  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Utilisé par le front pour savoir, à chaque chargement de page, si la
// personne est déjà connectée (et afficher son profil ou un lien
// "Connexion" selon le cas).
authRouter.get('/auth/me', requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
});
