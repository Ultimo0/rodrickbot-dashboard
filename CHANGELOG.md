# Changelog

## 0.3.0

### Ajouté
- **Réception effective des rapports d'erreur envoyés par RodrickBOT** :
  `core/telemetry.js::reportError` (côté bot) appelait déjà
  `POST /api/error-report` depuis plusieurs versions, mais aucune route
  ne l'attendait côté Hub — chaque appel recevait un 404 silencieusement
  absorbé. Cette version comble ce manque.
  - Nouvelle route `POST /api/error-report` (`src/routes/errorReports.js`),
    protégée par `requireApiKey` (même authentification que
    `POST /api/heartbeat` — même acteur automatisé). Validation stricte
    du type des champs reçus (rejet 400 si un champ attendu comme chaîne
    ne l'est pas) ; troncature défensive de leur longueur côté store
    (`src/store/errorReportsStore.js`) plutôt que rejet, pour ne jamais
    perdre un rapport à cause d'une stack un peu longue.
  - Nouvelle table `error_reports` (`src/db.js`), avec contrainte
    `UNIQUE ("instanceId", "errorMessage")` : une même erreur sur une même
    instance ne crée jamais plus d'une ligne — chaque nouvelle occurrence
    incrémente `occurrenceCount` et met à jour `lastSeenAt`
    (`ON CONFLICT ... DO UPDATE`), au lieu de faire grossir la table sans
    limite en cas de boucle d'erreur côté bot.
  - Nouvelle route `GET /api/error-reports`, protégée par `requireAuth` +
    `requireAdmin` — **jamais publique ni accessible via la clé API
    partagée**, contrairement à `GET /api/releases` : une stack trace peut
    révéler des détails d'implémentation internes.
  - Purge automatique après 30 jours **sans nouvelle occurrence**
    (`pruneOldErrorReports`, `src/db.js`), déclenchée au démarrage puis
    toutes les 24h — même mécanisme que la purge existante de
    `heartbeat_log`, avec sa propre constante `ERROR_REPORT_RETENTION_MS`
    (`src/config.js`).
  - Nouvelle page d'administration `public/errors.html` +
    `public/js/errors.js` : liste des erreurs triée par dernière
    occurrence, stack trace repliée par défaut (accordéon), réservée aux
    comptes admin (le serveur renvoie 401/403 aux autres, la page l'affiche
    clairement plutôt que d'essayer de le masquer côté client).

### Documentation
- `scripts/migrate-json-to-sqlite.js` : ajout d'un en-tête documentant son
  obsolescence (le script importe `DATA_FILE`/`RELEASES_FILE` depuis
  `src/config.js`, deux constantes qui n'existent plus depuis le passage
  à Postgres — il ne peut plus s'exécuter). Conservé tel quel, logique
  inchangée, à la demande explicite du propriétaire du projet.

## 0.2.0

### Ajouté
- **Suppression de compte en libre-service** : n'importe quel compte
  connecté (admin ou non) peut désormais supprimer définitivement son
  propre compte depuis `profile.html`, sans intervention d'un
  administrateur.
  - Nouvelle route `DELETE /api/profile` (`src/routes/profile.js`) :
    exige le mot de passe en confirmation (bcrypt), protège contre le
    brute-force via un nouveau `deleteAccountLimiter`
    (`src/middleware/rateLimit.js`), et bloque la suppression du
    **dernier** compte admin restant pour ne jamais laisser le Hub sans
    accès au panel admin.
  - `deleteUser()` et `countAdmins()` ajoutés à `src/store/usersStore.js`.
    La suppression tourne dans une transaction : les publications de la
    Communauté rédigées par ce compte (`posts."authorId"`, `NOT NULL`
    et sans `ON DELETE CASCADE`/`SET NULL` en base) sont supprimées avec
    lui, pour ne jamais laisser de ligne orpheline qui ferait planter le
    `INNER JOIN` de `postsStore.js`. `user_seen` et `push_subscriptions`
    n'ont rien à faire ici : ils ont déjà `ON DELETE CASCADE`.
  - Nouvelle section "Supprimer mon compte" dans `profile.html`/`profile.js`
    (mot de passe + double confirmation via `confirm()`, même pattern que
    les suppressions de version/publication ailleurs dans le Hub) et son
    style `.danger-zone`/`.btn-danger` dans `style.css`.

## 0.1.1

### Corrigé
- **Bug critique** : `adminRouter` était monté sur `/api` (comme tous les
  autres routers), et son `router.use(requireAuth, requireAdmin)` sans
  chemin interceptait donc **toute** requête sous `/api/*` — y compris
  `GET /api/posts`, `GET /api/stats`, les routes de `profile`,
  `notifications` et `push`, montées après lui. Un utilisateur connecté
  mais non-admin recevait un 403 ("Réservé aux administrateurs.") sur ces
  routes pourtant publiques, avant même qu'elles ne soient atteintes.
  Un admin ne voyait rien d'anormal puisque `requireAdmin` le laissait
  passer.
  - `adminRouter` est maintenant monté sur son propre préfixe
    `/api/admin` (`server.js`), et ses routes internes n'ont plus besoin
    du préfixe `/admin` (`src/routes/admin.js`) — les URLs finales
    (`/api/admin/users`, `/api/admin/users/:id/role`) restent identiques,
    aucun changement côté frontend.
