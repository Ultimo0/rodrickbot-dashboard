import { pool } from '../db.js';

/**
 * errorReportsStore.js
 * ------------------------------------------------------------------
 * Stockage des rapports d'erreur envoyés par core/telemetry.js::reportError
 * (RodrickBOT), reçus via POST /api/error-report (src/routes/errorReports.js).
 *
 * Déduplication : une même erreur (identifiée par le couple instanceId +
 * errorMessage) ne crée jamais plus d'une ligne — chaque nouvelle
 * occurrence incrémente "occurrenceCount" et met à jour "lastSeenAt" au
 * lieu d'insérer une nouvelle ligne (voir la contrainte UNIQUE sur la
 * table, src/db.js, et la clause ON CONFLICT ci-dessous). Sans ça, un bot
 * qui boucle sur la même exception (uncaughtException répété) remplirait
 * la table indéfiniment pour une seule et même cause.
 *
 * "botName"/"version"/"nodeVersion"/"errorStack" sont volontairement
 * conservés tels que reçus à la PREMIÈRE occurrence (jamais réécrits sur
 * un conflit) : le but ici est de savoir "depuis quand" et "combien de
 * fois", pas de suivre la dernière version en date sur laquelle l'erreur
 * est réapparue. Limite acceptée pour rester minimal (Phase 0) — à revoir
 * si un besoin réel de suivi par version apparaît.
 * ------------------------------------------------------------------
 */

// Bornes de troncature défensives : un payload anormal (bug côté bot,
// ou requête forgée directement avec la clé API) ne doit jamais pouvoir
// stocker des chaînes de taille arbitraire. Ces valeurs sont largement
// suffisantes pour diagnostiquer une erreur (voir core/telemetry.js côté
// bot, qui ne remonte déjà que les 5 premières lignes de la stack).
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;
const MAX_FIELD_LENGTH = 100; // instanceId, botName, version, nodeVersion

function truncate(value, maxLength) {
  if (typeof value !== 'string') return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Enregistre une occurrence d'erreur. La validation de TYPE (chaînes
 * attendues) est faite en amont par la route (src/routes/errorReports.js) —
 * ce module ne fait que la troncature défensive de LONGUEUR.
 */
export async function saveErrorReport({ instanceId, botName, version, nodeVersion, errorMessage, errorStack }) {
  const now = Date.now();

  const safeInstanceId = truncate(instanceId, MAX_FIELD_LENGTH);
  const safeMessage = truncate(errorMessage, MAX_MESSAGE_LENGTH);

  await pool.query(
    `INSERT INTO error_reports
       ("instanceId", "botName", "version", "nodeVersion", "errorMessage", "errorStack",
        "occurrenceCount", "firstSeenAt", "lastSeenAt")
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7)
     ON CONFLICT ("instanceId", "errorMessage")
     DO UPDATE SET
       "occurrenceCount" = error_reports."occurrenceCount" + 1,
       "lastSeenAt" = $7`,
    [
      safeInstanceId,
      truncate(botName, MAX_FIELD_LENGTH),
      truncate(version, MAX_FIELD_LENGTH),
      truncate(nodeVersion, MAX_FIELD_LENGTH),
      safeMessage,
      truncate(errorStack, MAX_STACK_LENGTH),
      now,
    ]
  );
}

/** Liste triée par dernière occurrence — les erreurs les plus "vivantes" en premier. */
export async function listErrorReports({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const { rows } = await pool.query(
    'SELECT * FROM error_reports ORDER BY "lastSeenAt" DESC LIMIT $1',
    [safeLimit]
  );
  return rows;
}

// La purge (pruneOldErrorReports) vit dans src/db.js, aux côtés de
// pruneOldHeartbeats — même convention que l'existant, pas dupliquée ici.
