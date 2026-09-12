import { Router } from 'express';
import { getOverview, getUserGrowth, getActivityOverTime, getTopCommands } from '../store/statsStore.js';
import { ah } from '../utils/asyncHandler.js';

export const statsRouter = Router();

// Public : ce sont des chiffres AGRÉGÉS (totaux, classements), jamais les
// détails individuels d'une instance précise (ça, c'est /api/instances,
// resté protégé par clé API). Personne ne peut identifier un utilisateur
// ou un bot précis à partir de ces chiffres.
statsRouter.get('/stats', ah(async (req, res) => {
  const [overview, userGrowth, activityOverTime, topCommands] = await Promise.all([
    getOverview(),
    getUserGrowth(30),
    getActivityOverTime(30),
    getTopCommands(10),
  ]);
  res.json({ overview, userGrowth, activityOverTime, topCommands });
}));
