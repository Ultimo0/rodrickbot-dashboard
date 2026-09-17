import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { updateProfile } from '../store/usersStore.js';
import { ah } from '../utils/asyncHandler.js';

export const profileRouter = Router();

const BIO_MAX_LENGTH = 280;

/**
 * Toujours req.session.userId comme cible — JAMAIS un id pris dans le
 * corps de la requête ou l'URL. Sans cette règle, n'importe quel compte
 * connecté pourrait passer l'id de quelqu'un d'autre et modifier SON
 * profil à lui. requireAuth garantit juste "il y a une session valide" —
 * c'est cette ligne-ci qui garantit "on ne modifie que SON PROPRE compte".
 */
profileRouter.patch('/profile', requireAuth, ah(async (req, res) => {
  const { name, bio, avatarUrl } = req.body || {};

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Le nom ne peut pas être vide.' });
  }
  if (bio !== undefined && typeof bio === 'string' && bio.length > BIO_MAX_LENGTH) {
    return res.status(400).json({ error: `La bio ne peut pas dépasser ${BIO_MAX_LENGTH} caractères.` });
  }
  // On fait confiance à l'URL renvoyée par Cloudinary après un upload
  // réussi (voir profile.js côté navigateur), mais on vérifie quand même
  // ici qu'elle pointe bien vers Cloudinary — en défense en profondeur,
  // au cas où quelqu'un appellerait cette route directement (en
  // contournant l'interface) avec une URL arbitraire.
  if (avatarUrl !== undefined && avatarUrl !== null && !String(avatarUrl).startsWith('https://res.cloudinary.com/')) {
    return res.status(400).json({ error: 'URL de photo de profil invalide.' });
  }

  const updated = await updateProfile(req.session.userId, { name, bio, avatarUrl });
  if (!updated) return res.status(404).json({ error: 'Compte introuvable.' });

  res.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      bio: updated.bio,
      avatarUrl: updated.avatarUrl,
      createdAt: updated.createdAt,
    },
  });
}));
