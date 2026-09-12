import { Router } from 'express';
import { requireApiKey } from '../middleware/requireApiKey.js';
import { loadInstances, saveInstances, logHeartbeat } from '../store/instancesStore.js';
import { OFFLINE_AFTER_MS } from '../config.js';
import { broadcast } from '../realtime.js';
import { ah } from '../utils/asyncHandler.js';

// Un Router, c'est un "mini app" Express qu'on peut définir dans son
// propre fichier puis brancher sur l'app principale (voir server.js :
// app.use('/api', instancesRouter)). Ça évite d'avoir TOUTES les routes
// du projet dans un seul fichier géant au fur et à mesure qu'on en ajoute
// (versions, comptes, communauté...).
export const instancesRouter = Router();

instancesRouter.post('/heartbeat', requireApiKey, ah(async (req, res) => {
  const {
    instanceId, ownerName, botName, version, uptimeSeconds,
    messageCount, commandStats, mode, prefix, nodeVersion,
  } = req.body || {};

  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId manquant.' });
  }

  const instances = await loadInstances();
  const previousEnabled = instances[instanceId]?.enabled ?? true;

  instances[instanceId] = {
    instanceId,
    ownerName: ownerName || 'Inconnu',
    botName: botName || 'RodrickBOT',
    version: version || '?',
    uptimeSeconds: uptimeSeconds ?? null,
    messageCount: messageCount ?? null,
    commandStats: commandStats || {},
    mode: mode || '?',
    prefix: prefix || '!',
    nodeVersion: nodeVersion || '?',
    enabled: previousEnabled,
    lastSeen: Date.now(),
  };
  await saveInstances(instances);
  await logHeartbeat(instanceId, messageCount);
  broadcast({ type: 'instance-update', instance: instances[instanceId] });

  res.json({ ok: true, enabled: previousEnabled });
}));

instancesRouter.post('/instances/:instanceId/toggle', requireApiKey, ah(async (req, res) => {
  const { instanceId } = req.params;
  const { enabled } = req.body || {};

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '"enabled" doit être un booléen.' });
  }

  const instances = await loadInstances();
  if (!instances[instanceId]) {
    return res.status(404).json({ error: 'Instance inconnue.' });
  }

  instances[instanceId].enabled = enabled;
  await saveInstances(instances);
  broadcast({ type: 'instance-update', instance: instances[instanceId] });

  res.json({ ok: true, instanceId, enabled });
}));

/**
 * Supprime définitivement les infos d'une instance (utile quand une copie
 * est hors ligne de façon permanente et qu'on veut nettoyer le dashboard).
 */
instancesRouter.delete('/instances/:instanceId', requireApiKey, ah(async (req, res) => {
  const { instanceId } = req.params;

  const instances = await loadInstances();
  if (!instances[instanceId]) {
    return res.status(404).json({ error: 'Instance inconnue.' });
  }

  delete instances[instanceId];
  await saveInstances(instances);
  broadcast({ type: 'instance-deleted', instanceId });

  res.json({ ok: true, instanceId, deleted: true });
}));

instancesRouter.get('/instances', requireApiKey, ah(async (req, res) => {
  const instances = await loadInstances();
  const now = Date.now();

  const list = Object.values(instances)
    .map((inst) => ({ ...inst, online: now - inst.lastSeen < OFFLINE_AFTER_MS }))
    .sort((a, b) => b.lastSeen - a.lastSeen);

  res.json({ instances: list, offlineAfterMs: OFFLINE_AFTER_MS });
}));
