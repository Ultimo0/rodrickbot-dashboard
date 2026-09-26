import { Router } from 'express';
import { requireApiKey } from '../middleware/requireApiKey.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { saveErrorReport, listErrorReports } from '../store/errorReportsStore.js';
import { ah } from '../utils/asyncHandler.js';

export const errorReportsRouter = Router();

/**
 * Reçoit les rapports d'erreur anonymisés envoyés par RodrickBOT
 * (core/telemetry.js::reportError, déclenché depuis
 * process.on('uncaughtException'/'unhandledRejection')).
 *
 * Même authentification que POST /api/heartbeat (clé API partagée par
 * instance, voir requireApiKey) : c'est le même acteur automatisé qui
 * appelle les deux routes, jamais un navigateur.
 *
 * Validation : rejet 400 si un champ attendu comme chaîne ne l'en est
 * pas (protège contre un payload structurellement anormal — tableau,
 * objet, nombre là où une chaîne est attendue). La LONGUEUR, elle, n'est
 * jamais un motif de rejet : une chaîne trop longue est tronquée côté
 * store (errorReportsStore.js) plutôt que rejetée, pour ne jamais perdre
 * un rapport à cause d'une stack un peu longue.
 */
errorReportsRouter.post('/error-report', requireApiKey, ah(async (req, res) => {
  const { instanceId, botName, version, nodeVersion, errorMessage, errorStack } = req.body || {};

  if (!instanceId || typeof instanceId !== 'string') {
    return res.status(400).json({ error: 'instanceId manquant ou invalide.' });
  }
  if (!errorMessage || typeof errorMessage !== 'string') {
    return res.status(400).json({ error: 'errorMessage manquant ou invalide.' });
  }
  if (botName !== undefined && botName !== null && typeof botName !== 'string') {
    return res.status(400).json({ error: 'botName doit être une chaîne.' });
  }
  if (version !== undefined && version !== null && typeof version !== 'string') {
    return res.status(400).json({ error: 'version doit être une chaîne.' });
  }
  if (nodeVersion !== undefined && nodeVersion !== null && typeof nodeVersion !== 'string') {
    return res.status(400).json({ error: 'nodeVersion doit être une chaîne.' });
  }
  if (errorStack !== undefined && errorStack !== null && typeof errorStack !== 'string') {
    return res.status(400).json({ error: 'errorStack doit être une chaîne.' });
  }

  await saveErrorReport({ instanceId, botName, version, nodeVersion, errorMessage, errorStack });

  res.json({ ok: true });
}));

/**
 * Lecture réservée aux administrateurs du Hub — contrairement à
 * /api/releases (public), une stack trace peut révéler des détails
 * d'implémentation internes du bot. Jamais accessible via la clé API
 * partagée (requireApiKey) : uniquement via une session admin.
 */
errorReportsRouter.get('/error-reports', requireAuth, requireAdmin, ah(async (req, res) => {
  const reports = await listErrorReports({ limit: req.query.limit });
  res.json({ reports });
}));
