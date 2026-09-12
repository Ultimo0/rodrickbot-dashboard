import { findUserById } from '../store/usersStore.js';
import { ah } from '../utils/asyncHandler.js';

/**
 * S'utilise APRÈS requireAuth (donc req.session.userId existe déjà) —
 * vérifie en plus que le compte a le rôle 'admin'. Deux middlewares
 * empilés plutôt qu'un seul gros : chacun vérifie une seule chose, et on
 * peut réutiliser requireAuth seul là où le rôle n'a pas d'importance.
 */
export const requireAdmin = ah(async (req, res, next) => {
  const user = await findUserById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux administrateurs.' });
  }
  next();
});
