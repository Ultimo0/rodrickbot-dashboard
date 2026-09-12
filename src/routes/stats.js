import { Router } from 'express';
import { getOverview, getUserGrowth, getActivityOverTime, getTopCommands } from '../store/statsStore.js';

export const statsRouter = Router();

// Public : ce sont des chiffres AGRÉGÉS (totaux, classements), jamais les
// détails individuels d'une instance précise (ça, c'est /api/instances,
// resté protégé par clé API). Personne ne peut identifier un utilisateur
// ou un bot précis à partir de ces chiffres.
statsRouter.get('/stats', (req, res) => {
  res.json({
    overview: getOverview(),
    userGrowth: getUserGrowth(30),
    activityOverTime: getActivityOverTime(30),
    topCommands: getTopCommands(10),
  });
});
