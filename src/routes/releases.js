import { Router } from 'express';
import { requireApiKey } from '../middleware/requireApiKey.js';
import { loadReleases, addRelease, getLatestRelease } from '../store/releasesStore.js';
import { ah } from '../utils/asyncHandler.js';

export const releasesRouter = Router();

// Volontairement PAS de requireApiKey ici : la liste des versions et leur
// changelog sont publics, comme le reste de la page "Gestion des
// versions" du Hub — n'importe quel visiteur doit pouvoir les consulter,
// pas seulement le propriétaire du bot.
releasesRouter.get('/releases', ah(async (req, res) => {
  res.json({ releases: await loadReleases() });
}));

releasesRouter.get('/releases/latest', ah(async (req, res) => {
  const latest = await getLatestRelease();
  if (!latest) {
    return res.status(404).json({ error: 'Aucune release publiée pour le moment.' });
  }
  res.json(latest);
}));

// Ici en revanche, requireApiKey est nécessaire : publier une nouvelle
// version est une action réservée à l'admin (toi), pas à n'importe quel
// visiteur du Hub.
releasesRouter.post('/releases', requireApiKey, ah(async (req, res) => {
  const { version, date, changelog, downloadUrl } = req.body || {};

  if (!version || !date) {
    return res.status(400).json({ error: '"version" et "date" sont obligatoires.' });
  }

  await addRelease({
    version,
    date,
    changelog: changelog || '',
    downloadUrl: downloadUrl || null,
  });

  res.json({ ok: true, version });
}));
