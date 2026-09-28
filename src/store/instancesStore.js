import { pool } from '../db.js';

// Postgres n'a pas de type "objet" ni de vrai booléen : commandStats est
// stocké en texte JSON, enabled en 0/1. rowToInstance() reconstruit la
// forme JS habituelle à la lecture, pour que le reste du code (les
// routes) ne voie jamais la différence.
function rowToInstance(row) {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    commandStats: row.commandStats ? JSON.parse(row.commandStats) : {},
    // NULL = jamais tenté depuis le démarrage du bot — distinct de false
    // (dernière tentative échouée) ou true (réussie), donc pas un simple
    // Boolean() comme pour "enabled" qui, lui, n'est jamais NULL.
    ytdlpLastRefreshOk: row.ytdlpLastRefreshOk === null ? null : Boolean(row.ytdlpLastRefreshOk),
    activeFeatures: row.activeFeatures ? JSON.parse(row.activeFeatures) : null,
    remoteConfig: row.remoteConfig ? JSON.parse(row.remoteConfig) : null,
  };
}

/** Renvoie un objet { instanceId: instance }, exactement comme avant. */
export async function loadInstances() {
  const { rows } = await pool.query('SELECT * FROM instances');
  const instances = {};
  for (const row of rows) instances[row.instanceId] = rowToInstance(row);
  return instances;
}

/**
 * Remplace TOUT le contenu de la table par l'objet donné — même logique
 * que l'ancien writeFileSync() qui réécrivait tout le fichier JSON d'un
 * coup. On utilise un client dédié (plutôt que le pool directement) pour
 * que BEGIN/COMMIT/ROLLBACK s'appliquent tous à la MÊME connexion — avec
 * le pool, chaque requête pourrait sinon partir sur une connexion
 * différente, ce qui casserait la transaction.
 */
export async function saveInstances(instances) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM instances');

    for (const inst of Object.values(instances)) {
      await client.query(
        `INSERT INTO instances
           ("instanceId", "ownerName", "botName", "version", "uptimeSeconds", "messageCount",
            "commandStats", "mode", "prefix", "nodeVersion", "enabled", "lastSeen",
            "reconnectCount", "lastDisconnectCode", "lastDisconnectAt",
            "ytdlpLastRefreshAt", "ytdlpLastRefreshOk", "ytdlpVersion",
            "groupCount", "activeFeatures",
            "remoteConfig", "configVersion", "appliedConfigVersion")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          inst.instanceId,
          inst.ownerName,
          inst.botName,
          inst.version,
          inst.uptimeSeconds,
          inst.messageCount,
          JSON.stringify(inst.commandStats || {}),
          inst.mode,
          inst.prefix,
          inst.nodeVersion,
          inst.enabled ? 1 : 0,
          inst.lastSeen,
          inst.reconnectCount ?? null,
          inst.lastDisconnectCode ?? null,
          inst.lastDisconnectAt ?? null,
          inst.ytdlpLastRefreshAt ?? null,
          inst.ytdlpLastRefreshOk === null || inst.ytdlpLastRefreshOk === undefined
            ? null
            : (inst.ytdlpLastRefreshOk ? 1 : 0),
          inst.ytdlpVersion ?? null,
          inst.groupCount ?? null,
          inst.activeFeatures ? JSON.stringify(inst.activeFeatures) : null,
          inst.remoteConfig ? JSON.stringify(inst.remoteConfig) : null,
          inst.configVersion ?? 0,
          inst.appliedConfigVersion ?? null,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Contrairement à saveInstances() (qui écrase le dernier snapshot connu),
 * ceci AJOUTE une ligne à chaque appel — c'est cet historique qui permet
 * de tracer une vraie courbe d'activité dans le temps (voir statsStore.js),
 * plutôt qu'une simple photo de l'instant présent.
 */
export async function logHeartbeat(instanceId, messageCount) {
  await pool.query(
    `INSERT INTO heartbeat_log ("instanceId", "messageCount", "timestamp") VALUES ($1, $2, $3)`,
    [instanceId, messageCount ?? null, Date.now()]
  );
}
