import { db } from '../db.js';
import { loadInstances } from './instancesStore.js';
import { OFFLINE_AFTER_MS } from '../config.js';

const countUsersStmt = db.prepare('SELECT COUNT(*) as count FROM users');
const countPostsStmt = db.prepare('SELECT COUNT(*) as count FROM posts');
const usersCreatedAtStmt = db.prepare('SELECT createdAt FROM users');
const heartbeatsSinceStmt = db.prepare('SELECT instanceId, timestamp FROM heartbeat_log WHERE timestamp >= ?');

/**
 * Répartit une liste de timestamps en un total par jour, sur les N
 * derniers jours — y compris les jours à 0 (un jour sans donnée doit
 * apparaître comme un creux dans le graphique, pas être absent).
 */
function bucketByDay(timestamps, days) {
  const buckets = new Map();
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  for (const ts of timestamps) {
    const key = new Date(ts).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  }

  return Array.from(buckets, ([date, count]) => ({ date, count }));
}

/** Chiffres globaux, pour les cartes en haut de la page statistiques. */
export function getOverview() {
  const instances = Object.values(loadInstances());
  const now = Date.now();

  return {
    totalUsers: countUsersStmt.get().count,
    totalPosts: countPostsStmt.get().count,
    totalInstances: instances.length,
    onlineInstances: instances.filter((i) => now - i.lastSeen < OFFLINE_AFTER_MS).length,
    totalMessages: instances.reduce((sum, i) => sum + (i.messageCount || 0), 0),
  };
}

/** Nouveaux comptes Hub par jour, sur les N derniers jours. */
export function getUserGrowth(days = 30) {
  const timestamps = usersCreatedAtStmt.all().map((r) => r.createdAt);
  return bucketByDay(timestamps, days);
}

/**
 * Nombre d'INSTANCES DISTINCTES ayant envoyé au moins un heartbeat, par
 * jour. Volontairement pas "nombre de messages par jour" : messageCount
 * est un compteur qui repart à zéro à chaque redémarrage d'une instance
 * RodrickBOT, donc en faire une simple somme jour par jour donnerait des
 * chiffres trompeurs. Le nombre d'instances actives est une mesure plus
 * honnête de l'activité réelle du réseau.
 */
export function getActivityOverTime(days = 30) {
  const rows = heartbeatsSinceStmt.all(Date.now() - days * 24 * 60 * 60 * 1000);

  const byDay = new Map();
  for (const row of rows) {
    const key = new Date(row.timestamp).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key).add(row.instanceId);
  }

  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: byDay.has(key) ? byDay.get(key).size : 0 });
  }
  return result;
}

/** Classement des commandes les plus utilisées, toutes instances confondues. */
export function getTopCommands(limit = 10) {
  const instances = Object.values(loadInstances());
  const totals = {};

  for (const inst of instances) {
    for (const [cmd, count] of Object.entries(inst.commandStats || {})) {
      totals[cmd] = (totals[cmd] || 0) + count;
    }
  }

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
