import { findUserById } from '../store/usersStore.js';

/**
 * S'utilise APRÈS requireAuth (donc req.session.userId existe déjà) —
 * vérifie en plus que le compte a le rôle 'admin'. Deux middlewares
 * empilés plutôt qu'un seul gros : chacun vérifie une seule chose, et on
 * peut réutiliser requireAuth seul là où le rôle n'a pas d'importance.
 */
export function requireAdmin(req, res, next) {
  const user = findUserById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux administrateurs.' });
  }
  next();
}
