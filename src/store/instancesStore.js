import { db } from '../db.js';

// Une "prepared statement" : une requête SQL écrite une seule fois,
// réutilisée à chaque appel. Plus rapide et plus sûr qu'une requête
// reconstruite en texte à chaque fois (ça évite aussi les injections SQL).
const selectAll = db.prepare('SELECT * FROM instances');
const deleteAll = db.prepare('DELETE FROM instances');
const upsert = db.prepare(`
  INSERT INTO instances (instanceId, ownerName, botName, version, uptimeSeconds, messageCount, commandStats, mode, prefix, nodeVersion, enabled, lastSeen)
  VALUES (@instanceId, @ownerName, @botName, @version, @uptimeSeconds, @messageCount, @commandStats, @mode, @prefix, @nodeVersion, @enabled, @lastSeen)
`);

// SQLite n'a pas de type "objet" ni de vrai booléen : commandStats est
// stocké en texte JSON, enabled en 0/1. rowToInstance() reconstruit la
// forme JS habituelle à la lecture, pour que le reste du code (les
// routes) ne voie jamais la différence.
function rowToInstance(row) {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    commandStats: row.commandStats ? JSON.parse(row.commandStats) : {},
  };
}

/** Renvoie un objet { instanceId: instance }, exactement comme avant avec le JSON. */
export function loadInstances() {
  const instances = {};
  for (const row of selectAll.all()) instances[row.instanceId] = rowToInstance(row);
  return instances;
}

/**
 * Remplace TOUT le contenu de la table par l'objet donné — même logique
 * que l'ancien writeFileSync() qui réécrivait tout le fichier JSON d'un
 * coup. db.transaction() garantit que le DELETE + les INSERT se font tous
 * ensemble ou pas du tout (si le serveur plante au milieu, pas de données
 * à moitié écrites).
 */
export const saveInstances = db.transaction((instances) => {
  deleteAll.run();
  for (const inst of Object.values(instances)) {
    upsert.run({
      ...inst,
      enabled: inst.enabled ? 1 : 0,
      commandStats: JSON.stringify(inst.commandStats || {}),
    });
  }
});

const insertHeartbeatLog = db.prepare(
  'INSERT INTO heartbeat_log (instanceId, messageCount, timestamp) VALUES (?, ?, ?)'
);

/**
 * Contrairement à saveInstances() (qui écrase le dernier snapshot connu),
 * ceci AJOUTE une ligne à chaque appel — c'est cet historique qui permet
 * de tracer une vraie courbe d'activité dans le temps (voir statsStore.js),
 * plutôt qu'une simple photo de l'instant présent.
 */
export function logHeartbeat(instanceId, messageCount) {
  insertHeartbeatLog.run(instanceId, messageCount ?? null, Date.now());
}
