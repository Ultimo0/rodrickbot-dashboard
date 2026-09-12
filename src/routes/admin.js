import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { listUsers, findUserById, updateUserRole } from '../store/usersStore.js';
import { ah } from '../utils/asyncHandler.js';

export const adminRouter = Router();

// Deux middlewares empilés : requireAuth vérifie qu'une session existe,
// requireAdmin vérifie ENSUITE que cette session appartient à un admin.
// S'appliquent dans l'ordre à TOUTES les routes définies plus bas grâce
// à router.use() — pas besoin de les répéter sur chaque route une par une.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/admin/users', ah(async (req, res) => {
  res.json({ users: await listUsers() });
}));

adminRouter.patch('/admin/users/:id/role', ah(async (req, res) => {
  const targetId = Number(req.params.id);
  const { role } = req.body || {};

  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: 'Rôle invalide (attendu : "user" ou "admin").' });
  }

  // Protection importante : impossible de changer SON PROPRE rôle. Sans
  // ça, un admin pourrait accidentellement se rétrograder et se
  // retrouver bloqué hors du panel admin, sans personne pour le
  // remettre admin (si c'était le seul).
  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'Impossible de modifier ton propre rôle — demande à un autre admin.' });
  }

  const target = await findUserById(targetId);
  if (!target) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  await updateUserRole(targetId, role);
  res.json({ ok: true, id: targetId, role });
}));
