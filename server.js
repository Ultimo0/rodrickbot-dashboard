import 'dotenv/config';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'instances.json');
const API_KEY = process.env.DASHBOARD_API_KEY || '';
const PORT = process.env.PORT || 3000;

// Une instance est considérée "hors ligne" si elle n'a pas envoyé de
// heartbeat depuis plus de 2x l'intervalle attendu côté bot (5min par
// défaut) — donc 10 minutes ici.
const OFFLINE_AFTER_MS = 10 * 60 * 1000;

if (!API_KEY) {
  console.warn(
    '⚠️  DASHBOARD_API_KEY n\'est pas défini dans .env — le serveur démarre mais rejettera toutes les requêtes. ' +
      'Définis une clé secrète avant de le déployer.'
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

/** Appelé périodiquement par chaque copie du bot. */
app.post('/api/heartbeat', requireApiKey, (req, res) => {
  const { instanceId, ownerName, botName, version, uptimeSeconds, messageCount, mode, prefix, nodeVersion } =
    req.body || {};

  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId manquant.' });
  }

  const instances = loadInstances();
  instances[instanceId] = {
    instanceId,
    ownerName: ownerName || 'Inconnu',
    botName: botName || 'RodrickBOT',
    version: version || '?',
    uptimeSeconds: uptimeSeconds ?? null,
    messageCount: messageCount ?? null,
    mode: mode || '?',
    prefix: prefix || '!',
    nodeVersion: nodeVersion || '?',
    lastSeen: Date.now(),
  };
  saveInstances(instances);

  res.json({ ok: true });
});

/** Utilisé par le tableau de bord (public/index.html) pour afficher les instances. */
app.get('/api/instances', requireApiKey, (req, res) => {
  const instances = loadInstances();
  const now = Date.now();

  const list = Object.values(instances)
    .map((inst) => ({
      ...inst,
      online: now - inst.lastSeen < OFFLINE_AFTER_MS,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen);

  res.json({ instances: list, offlineAfterMs: OFFLINE_AFTER_MS });
});

app.listen(PORT, () => {
  console.log(`Dashboard RodrickBOT en écoute sur le port ${PORT}`);
});