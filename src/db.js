import pg from 'pg';
import { DATABASE_URL } from './config.js';

const { Pool, types } = pg;

// Par défaut, pg renvoie les colonnes BIGINT sous forme de CHAÎNES DE
// CARACTÈRES (pas de nombres) — parce qu'un BIGINT peut dépasser la
// limite de précision sûre des nombres JavaScript (Number.MAX_SAFE_INTEGER,
// environ 9 x 10^15). Ici, BIGINT ne sert qu'à stocker des timestamps en
// millisecondes (Date.now()) — bien en dessous de cette limite — donc on
// force pg à les convertir en vrais nombres. Sans ça, des comparaisons
// (a.lastSeen - b.lastSeen) fonctionneraient par coïncidence (JS convertit
// implicitement), mais new Date(row.timestamp) casserait silencieusement
// (une chaîne comme "1699999999999" n'est pas une date ISO valide).
// 20 = OID du type BIGINT dans le catalogue interne de Postgres.
types.setTypeParser(20, (value) => parseInt(value, 10));

/**
 * Un seul Pool, partagé par tout le projet (import { pool } from './db.js'
 * partout où on en a besoin) — le Pool gère lui-même plusieurs connexions
 * simultanées vers Postgres et les réutilise, contrairement à une seule
 * connexion ouverte en permanence comme avec better-sqlite3.
 *
 * ssl: { rejectUnauthorized: false } est la configuration standard
 * recommandée par les fournisseurs de Postgres "serverless" comme Neon —
 * la connexion est bien chiffrée (TLS), on ne vérifie juste pas la chaîne
 * de certificats contre l'autorité racine locale, ce qui évite des erreurs
 * de connexion sur certains environnements sans configuration TLS
 * supplémentaire de leur côté.
 */
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * IMPORTANT — Postgres met en minuscules tout identifiant (nom de colonne)
 * qui n'est pas entre guillemets doubles. Comme tout le reste du code
 * utilise des noms de colonnes en camelCase (instanceId, ownerName,
 * createdAt...) et s'attend à les relire tels quels dans les résultats de
 * requête, CHAQUE colonne camelCase est déclarée et référencée entre
 * guillemets doubles ("instanceId") partout dans ce fichier et dans
 * src/store/*.js. Oublier un guillemet quelque part est la source d'erreur
 * la plus probable si tu modifies ce schéma plus tard.
 */
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instances (
      "instanceId"    TEXT PRIMARY KEY,
      "ownerName"     TEXT,
      "botName"       TEXT,
      "version"       TEXT,
      "uptimeSeconds" BIGINT,
      "messageCount"  BIGINT,
      "commandStats"  TEXT,    -- objet JS stocké en texte JSON (comme avec SQLite)
      "mode"          TEXT,
      "prefix"        TEXT,
      "nodeVersion"   TEXT,
      "enabled"       INTEGER NOT NULL DEFAULT 1,  -- 0 = false, 1 = true (comme avec SQLite)
      "lastSeen"      BIGINT
    );

    CREATE TABLE IF NOT EXISTS releases (
      id            SERIAL PRIMARY KEY,
      version       TEXT NOT NULL,
      date          TEXT NOT NULL,
      changelog     TEXT,
      "downloadUrl" TEXT
    );

    CREATE TABLE IF NOT EXISTS commands (
      name          TEXT PRIMARY KEY,
      aliases       TEXT,   -- tableau JS stocké en texte JSON
      description   TEXT,
      category      TEXT,
      "adminOnly"   INTEGER NOT NULL DEFAULT 0,
      syntax        TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id             SERIAL PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'user',  -- 'user' ou 'admin'
      "createdAt"    BIGINT NOT NULL,
      name           TEXT,
      bio            TEXT,
      "avatarUrl"    TEXT
    );

    -- Migration défensive : sur une base DÉJÀ existante (le Hub tournait
    -- avant l'ajout du profil complet), la table users existe déjà sans
    -- ces deux colonnes — CREATE TABLE IF NOT EXISTS ci-dessus ne les
    -- ajouterait pas puisque la table n'est pas recréée. IF NOT EXISTS
    -- ici rend ces lignes sûres à rejouer à chaque démarrage, y compris
    -- sur une base qui les a déjà (aucune erreur, aucun doublon).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

    CREATE TABLE IF NOT EXISTS posts (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'publication', -- 'publication' | 'annonce' | 'nouveaute' | 'guide'
      "authorId"  INTEGER NOT NULL REFERENCES users(id),
      "createdAt" BIGINT NOT NULL
    );

    -- Contrairement à "instances" (qui ne garde que le DERNIER heartbeat de
    -- chaque instance, écrasé à chaque fois), cette table ajoute une ligne
    -- à CHAQUE heartbeat reçu — un vrai historique, nécessaire pour tracer
    -- une courbe d'activité dans le temps plutôt qu'une simple photo du
    -- moment présent.
    CREATE TABLE IF NOT EXISTS heartbeat_log (
      id             SERIAL PRIMARY KEY,
      "instanceId"   TEXT NOT NULL,
      "messageCount" BIGINT,
      "timestamp"    BIGINT NOT NULL
    );
  `);
}

await initSchema();
