import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { PORT, PUBLIC_DIR, SESSION_SECRET, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, HEARTBEAT_RETENTION_MS, warnIfMisconfigured } from './src/config.js';
import { pool, pruneOldHeartbeats } from './src/db.js';
import { instancesRouter } from './src/routes/instances.js';
import { releasesRouter } from './src/routes/releases.js';
import { commandsRouter } from './src/routes/commands.js';
import { authRouter } from './src/routes/auth.js';
import { adminRouter } from './src/routes/admin.js';
import { postsRouter } from './src/routes/posts.js';
import { statsRouter } from './src/routes/stats.js';
import { profileRouter } from './src/routes/profile.js';
import { initRealtime } from './src/realtime.js';

warnIfMisconfigured();

const app = express();

// Nécessaire derrière un reverse proxy qui termine le HTTPS (Render,
// Railway, Fly.io...) : sans ça, Express voit toujours la requête en HTTP
// "en interne" (le proxy la lui transmet ainsi), et ne peut donc jamais
// savoir que la connexion d'origine était bien chiffrée — ce qui casse
// silencieusement cookie.secure ci-dessous (le cookie ne serait alors
// jamais envoyé au navigateur).
app.set('trust proxy', 1);

// helmet ajoute d'un coup un ensemble d'en-têtes de sécurité HTTP
// standards (X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
// HSTS...) et retire X-Powered-By (qui annonçait "Express" à quiconque
// inspectait les en-têtes, une information interne inutile à exposer).
// contentSecurityPolicy: false — DÉSACTIVÉ pour l'instant : la CSP par
// défaut de helmet bloquerait les scripts inline utilisés dans le <head>
// de chaque page (pour appliquer le thème sauvegardé avant l'affichage,
// voir js/theme.js) ainsi que les polices Google Fonts. La activer
// correctement demanderait de passer ces pages par un moteur de rendu
// côté serveur (pour générer un nonce différent à chaque requête) —
// un changement d'architecture plus large que ce correctif.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json());

const PgSession = connectPgSimple(session);

// express-session doit être branché AVANT les routes qui en ont besoin
// (req.session n'existe que grâce à ce middleware). "resave: false" et
// "saveUninitialized: false" sont les réglages recommandés par défaut :
// ils évitent de sauvegarder des sessions vides ou inchangées à chaque
// requête.
//
// store: les sessions vivent dans Postgres (table "session", créée
// automatiquement au démarrage grâce à createTableIfMissing) plutôt qu'en
// mémoire du process — sans ça (MemoryStore, le défaut d'express-session),
// tout le monde serait déconnecté à chaque redémarrage du service, et la
// mémoire grossirait indéfiniment tant que le process tourne.
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true, tableName: 'session' }),
  secret: SESSION_SECRET || 'valeur-par-defaut-non-securisee-a-changer',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours avant déconnexion automatique
    // secure: seulement en production (Render définit NODE_ENV=production
    // automatiquement) — jamais en local, où le serveur tourne en http://
    // simple sans TLS, et où un cookie "secure" ne serait jamais envoyé
    // par le navigateur (rendant la connexion impossible en dev).
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // déjà la valeur par défaut d'express-session, explicité pour que ce soit visible sans avoir à vérifier la doc
    sameSite: 'lax',
  },
}));

app.use(express.static(PUBLIC_DIR));

// Toutes les routes de src/routes/instances.js deviennent accessibles sous
// /api/... (ex: /api/heartbeat, /api/instances).
app.use('/api', instancesRouter);
app.use('/api', releasesRouter);
app.use('/api', commandsRouter);
app.use('/api', authRouter);
app.use('/api', adminRouter);
app.use('/api', postsRouter);
app.use('/api', statsRouter);
app.use('/api', profileRouter);

// Publique et volontairement sans authentification : ces deux valeurs ne
// sont pas des secrets (voir le commentaire sur CLOUDINARY_CLOUD_NAME
// dans src/config.js) — le navigateur en a besoin pour uploader une photo
// de profil DIRECTEMENT vers Cloudinary, sans repasser par notre serveur.
app.get('/api/config', (req, res) => {
  res.json({
    cloudinaryCloudName: CLOUDINARY_CLOUD_NAME,
    cloudinaryUploadPreset: CLOUDINARY_UPLOAD_PRESET,
  });
});

// Middleware d'erreur global — reçoit tout ce que ah() (src/utils/asyncHandler.js)
// redirige avec next(err), typiquement une requête Postgres qui échoue
// (connexion perdue, contrainte violée...). DOIT être déclaré après toutes
// les routes : Express reconnaît un middleware d'erreur au fait qu'il a
// 4 paramètres (err, req, res, next), peu importe où il est dans le fichier,
// mais il ne s'applique qu'aux routes déclarées AVANT lui.
app.use((err, req, res, next) => {
  console.error('Erreur non gérée sur une route :', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// On crée le serveur HTTP nous-mêmes (au lieu du simple app.listen()
// habituel) pour pouvoir y attacher le serveur WebSocket EN PLUS
// d'Express — les deux partagent le même port, distingués automatiquement
// par le protocole de la requête (http:// classique vs ws://).
const httpServer = http.createServer(app);
initRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Rodrick Hub en écoute sur le port ${PORT} (HTTP + WebSocket)`);
});

// Purge des heartbeats trop anciens (voir pruneOldHeartbeats dans
// src/db.js pour le raisonnement complet). Une fois au démarrage — utile
// si le service reste éteint plusieurs jours puis redémarre — puis toutes
// les 24h tant que le process tourne. Une simple erreur ici (ex: base de
// données momentanément injoignable) ne doit jamais faire planter le
// serveur : elle est seulement loguée, la prochaine tentative aura lieu
// au prochain intervalle.
async function runHeartbeatCleanup() {
  try {
    const deleted = await pruneOldHeartbeats(HEARTBEAT_RETENTION_MS);
    if (deleted > 0) console.log(`🧹 ${deleted} entrées de heartbeat_log de plus de 90 jours supprimées.`);
  } catch (err) {
    console.error('Échec de la purge de heartbeat_log :', err);
  }
}

runHeartbeatCleanup();
setInterval(runHeartbeatCleanup, 24 * 60 * 60 * 1000);
