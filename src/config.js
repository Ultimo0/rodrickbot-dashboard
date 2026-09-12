import path from 'path';
import { fileURLToPath } from 'url';

// __dirname n'existe pas nativement avec les modules ES (import/export) —
// c'est le prix à payer pour la syntaxe moderne. Ces deux lignes le
// recréent manuellement, une fois pour tout le projet.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ROOT_DIR pointe vers la racine du projet (un dossier au-dessus de src/),
// pour que les autres fichiers n'aient jamais à écrire "../.." eux-mêmes.
export const ROOT_DIR = path.join(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

export const PORT = process.env.PORT || 3000;
export const API_KEY = process.env.DASHBOARD_API_KEY || '';
export const SESSION_SECRET = process.env.SESSION_SECRET || '';

// Chaîne de connexion Postgres (ex: Neon) — remplace l'ancien fichier
// SQLite local. Format : postgresql://user:password@host/dbname?sslmode=require
export const DATABASE_URL = process.env.DATABASE_URL || '';

// Une instance est considérée "hors ligne" si elle n'a pas envoyé de
// heartbeat depuis plus longtemps que ça.
export const OFFLINE_AFTER_MS = 10 * 60 * 1000;

export function warnIfMisconfigured() {
  if (!DATABASE_URL) {
    console.warn(
      "⚠️  DATABASE_URL n'est pas défini dans .env — le serveur démarre mais toute requête à la base de données échouera."
    );
  }
  if (!API_KEY) {
    console.warn(
      "⚠️  DASHBOARD_API_KEY n'est pas défini dans .env — le serveur démarre mais rejettera toutes les requêtes."
    );
  }
  if (!SESSION_SECRET) {
    console.warn(
      "⚠️  SESSION_SECRET n'est pas défini dans .env — les sessions utiliseront une valeur par défaut non sécurisée."
    );
  }
}
