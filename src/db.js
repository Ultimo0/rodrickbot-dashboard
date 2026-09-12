import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { DATA_DIR, DB_FILE } from './config.js';

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

/**
 * Une seule connexion, partagée par tout le projet (import { db } from
 * './db.js' partout où on en a besoin) — contrairement aux fichiers JSON
 * qu'on ouvrait/fermait à chaque lecture, une base de données garde une
 * connexion ouverte pendant toute la vie du serveur.
 */
export const db = new Database(DB_FILE);

// WAL = "Write-Ahead Logging", un mode qui permet à SQLite de lire et
// écrire en même temps sans se bloquer l'un l'autre. Recommandé pour
// à peu près tous les projets Node + SQLite, sans inconvénient réel ici.
db.pragma('journal_mode = WAL');

/**
 * CREATE TABLE IF NOT EXISTS : ne fait RIEN si la table existe déjà —
 * donc on peut appeler cette fonction à chaque démarrage du serveur sans
 * risque d'effacer des données. C'est ce qui remplace le "if (!existsSync)"
 * qu'on avait dans les anciens stores JSON.
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
      instanceId    TEXT PRIMARY KEY,
      ownerName     TEXT,
      botName       TEXT,
      version       TEXT,
      uptimeSeconds INTEGER,
      messageCount  INTEGER,
      commandStats  TEXT,    -- objet JS stocké en texte JSON (SQLite n'a pas de type "objet")
      mode          TEXT,
      prefix        TEXT,
      nodeVersion   TEXT,
      enabled       INTEGER NOT NULL DEFAULT 1,  -- SQLite n'a pas de vrai booléen : 0 = false, 1 = true
      lastSeen      INTEGER
    );

    CREATE TABLE IF NOT EXISTS releases (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      version     TEXT NOT NULL,
      date        TEXT NOT NULL,
      changelog   TEXT,
      downloadUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS commands (
      name        TEXT PRIMARY KEY,
      aliases     TEXT,   -- tableau JS stocké en texte JSON
      description TEXT,
      category    TEXT,
      adminOnly   INTEGER NOT NULL DEFAULT 0,
      syntax      TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'user',  -- 'user' ou 'admin'
      createdAt    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT NOT NULL,
      content   TEXT NOT NULL,
      category  TEXT NOT NULL DEFAULT 'publication', -- 'publication' | 'annonce' | 'nouveaute' | 'guide'
      authorId  INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (authorId) REFERENCES users(id)
    );

    -- Contrairement à "instances" (qui ne garde que le DERNIER heartbeat de
    -- chaque instance, écrasé à chaque fois), cette table ajoute une ligne
    -- à CHAQUE heartbeat reçu — un vrai historique, nécessaire pour tracer
    -- une courbe d'activité dans le temps plutôt qu'une simple photo du
    -- moment présent.
    CREATE TABLE IF NOT EXISTS heartbeat_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      instanceId   TEXT NOT NULL,
      messageCount INTEGER,
      timestamp    INTEGER NOT NULL
    );
  `);
}

initSchema();

/**
 * Migration : ajoute la colonne "name" si elle n'existe pas déjà.
 *
 * Pourquoi pas juste dans initSchema() : CREATE TABLE IF NOT EXISTS ne
 * modifie JAMAIS une table qui existe déjà, même si sa définition a
 * changé — donc ajouter "name" à la définition de la table ci-dessus
 * n'aurait aucun effet sur une base déjà créée. Il faut une vraie requête
 * ALTER TABLE, une seule fois. SQLite lève une erreur si la colonne
 * existe déjà — on l'attrape et on l'ignore, ce qui rend cette fonction
 * sûre à exécuter à chaque démarrage du serveur.
 */
function migrateAddNameColumn() {
  try {
    db.exec('ALTER TABLE users ADD COLUMN name TEXT');
    console.log('Migration : colonne "name" ajoutée à la table users.');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) throw err;
    // sinon : la colonne existe déjà, rien à faire
  }
}

migrateAddNameColumn();
