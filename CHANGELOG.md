# Changelog

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
