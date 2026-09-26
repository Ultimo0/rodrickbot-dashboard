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

// Config Cloudinary pour l'upload des photos de profil. Ces deux valeurs
// ne sont PAS secrètes (voir /api/config dans server.js) : un upload "non
// signé" fonctionne justement en donnant au navigateur juste assez
// d'infos pour uploader vers CE compte Cloudinary précis, sans jamais lui
// confier la clé secrète de l'API (qui, elle, resterait uniquement côté
// serveur si on en avait besoin — ce n'est pas le cas ici).
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';

// Pour l'email "réinitialiser ton mot de passe" (voir src/routes/auth.js) :
// il faut construire un lien complet vers CE Hub précis, pas juste un
// chemin relatif. RENDER_EXTERNAL_URL est injectée automatiquement par
// Render sur tout service web (pas besoin de la définir à la main) —
// APP_URL permet de la remplacer explicitement si jamais elle manque
// (Render ne la fournit pas pour les services créés avant l'existence de
// cette variable) ou en développement local.
//
// BREVO_FROM_EMAIL doit être une adresse VÉRIFIÉE dans Brevo (Settings →
// Senders, Domains, IPs → Senders — un code à 6 chiffres reçu par email
// suffit, aucun nom de domaine requis). Contrairement à certains services
// équivalents, Brevo n'exige pas de domaine vérifié pour envoyer à
// n'importe quel destinataire — seulement pour l'ADRESSE D'ENVOI.
export const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
export const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
export const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// Notifications push (voir src/push.js). VAPID_CONTACT_EMAIL est requis
// par la norme Web Push — c'est l'adresse que les services de
// notification (Google, Mozilla...) utilisent pour te contacter en cas
// d'abus détecté depuis ce serveur, pas une adresse visible des
// utilisateurs.
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
export const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL || '';

// Une instance est considérée "hors ligne" si elle n'a pas envoyé de
// heartbeat depuis plus longtemps que ça.
export const OFFLINE_AFTER_MS = 10 * 60 * 1000;

// Durée de conservation de l'historique brut des heartbeats (voir
// src/db.js, pruneOldHeartbeats) — largement au-dessus des 30 jours que
// les statistiques affichent réellement (src/store/statsStore.js), pour
// ne jamais couper une fenêtre encore consultée à l'écran.
export const HEARTBEAT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Durée de conservation des rapports d'erreur (src/db.js,
// pruneOldErrorReports) — plus courte que HEARTBEAT_RETENTION_MS : un
// rapport d'erreur n'a de valeur que pour diagnostiquer un problème
// récent, pas pour une analyse de tendance longue durée comme les
// heartbeats.
export const ERROR_REPORT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    console.warn(
      "⚠️  CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET manquant(s) dans .env — le changement de photo de profil ne fonctionnera pas."
    );
  }
  if (!BREVO_API_KEY || !BREVO_FROM_EMAIL) {
    console.warn(
      "⚠️  BREVO_API_KEY / BREVO_FROM_EMAIL manquant(s) dans .env — la réinitialisation de mot de passe par email ne fonctionnera pas."
    );
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn(
      "⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquant(s) dans .env — les notifications push ne fonctionneront pas."
    );
  }
}
