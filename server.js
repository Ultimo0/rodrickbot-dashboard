import 'dotenv/config';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'instances.json');
const SUMMON_FILE = path.join(DATA_DIR, 'summon.json');
const API_KEY = process.env.DASHBOARD_API_KEY || '';
const PORT = process.env.PORT || 3000;

const OFFLINE_AFTER_MS = 10 * 60 * 1000;

// Message par défaut envoyé par toutes les copies quand on appuie sur le
// bouton "Invocation" du dashboard.
const DEFAULT_SUMMON_MESSAGE = "Je m'incline devant votre sagesse, Seigneur.";

if (!API_KEY) {
  console.warn(
    '⚠️  DASHBOARD_API_KEY n\'est pas défini dans .env — le serveur démarre mais rejettera toutes les requêtes.'
  );
}

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadInstances() {
  if (!existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveInstances(instances) {
  writeFileSync(DATA_FILE, JSON.stringify(instances, null, 2));
}

/**
 * "Invocation" globale : un seul enregistrement, remplacé à chaque appui sur
 * le bouton. Chaque copie du bot poll GET /api/summon très régulièrement
 * (voir core/summonListener.js côté bot) et compare l'`id` reçu à celui
 * qu'elle a déjà traité — un nouvel id = une nouvelle invocation à exécuter.
 * Volontairement un fichier séparé et minuscule (pas mêlé à instances.json)
 * puisqu'il est lu beaucoup plus souvent que le reste.
 */
function loadSummon() {
  if (!existsSync(SUMMON_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SUMMON_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveSummon(summon) {
  writeFileSync(SUMMON_FILE, JSON.stringify(summon, null, 2));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireApiKey(req, res, next) {
  const key = req.header('x-api-key');
  if (!API_KEY || key !== API_KEY) {
    return res.status(401).json({ error: 'Clé API manquante ou invalide.' });
  }
  next();
}

app.post('/api/heartbeat', requireApiKey, (req, res) => {
  const {
    instanceId, ownerName, botName, version, uptimeSeconds,
    messageCount, commandStats, mode, prefix, nodeVersion,
  } = req.body || {};

  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId manquant.' });
  }

  const instances = loadInstances();
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
  saveInstances(instances);

  res.json({ ok: true, enabled: previousEnabled });
});

app.post('/api/instances/:instanceId/toggle', requireApiKey, (req, res) => {
  const { instanceId } = req.params;
  const { enabled } = req.body || {};

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '"enabled" doit être un booléen.' });
  }

  const instances = loadInstances();
  if (!instances[instanceId]) {
    return res.status(404).json({ error: 'Instance inconnue.' });
  }

  instances[instanceId].enabled = enabled;
  saveInstances(instances);

  res.json({ ok: true, instanceId, enabled });
});

/**
 * Supprime définitivement les infos d'une instance (utile quand une copie
 * est hors ligne de façon permanente et qu'on veut nettoyer le dashboard).
 */
app.delete('/api/instances/:instanceId', requireApiKey, (req, res) => {
  const { instanceId } = req.params;

  const instances = loadInstances();
  if (!instances[instanceId]) {
    return res.status(404).json({ error: 'Instance inconnue.' });
  }

  delete instances[instanceId];
  saveInstances(instances);

  res.json({ ok: true, instanceId, deleted: true });
});

app.get('/api/instances', requireApiKey, (req, res) => {
  const instances = loadInstances();
  const now = Date.now();

  const list = Object.values(instances)
    .map((inst) => ({ ...inst, online: now - inst.lastSeen < OFFLINE_AFTER_MS }))
    .sort((a, b) => b.lastSeen - a.lastSeen);

  res.json({ instances: list, offlineAfterMs: OFFLINE_AFTER_MS });
});

/**
 * Déclenche une nouvelle invocation : toutes les copies actives vont, dans
 * les ~10s (voir SUMMON_POLL_INTERVAL_MS côté bot), envoyer le message dans
 * tous leurs groupes. Écrase toute invocation précédente (un seul appui
 * suffit, pas d'accumulation).
 */
app.post('/api/summon', requireApiKey, (req, res) => {
  const { message } = req.body || {};

  const summon = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: (typeof message === 'string' && message.trim()) || DEFAULT_SUMMON_MESSAGE,
    createdAt: Date.now(),
  };
  saveSummon(summon);

  res.json({ ok: true, summon });
});

/** Lu très fréquemment par les copies du bot — reste volontairement léger. */
app.get('/api/summon', requireApiKey, (req, res) => {
  res.json({ summon: loadSummon() });
});

app.listen(PORT, () => {
  console.log(`Dashboard RodrickBOT en écoute sur le port ${PORT}`);
});