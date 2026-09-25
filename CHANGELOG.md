# Changelog

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
