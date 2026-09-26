# Rodrick Hub — Phase 0 — Prêt à l'emploi

Ce zip contient **10 fichiers**, exactement ceux touchés par la Phase 0 —
à extraire par-dessus votre dossier local `rodrick-hub` (en gardant votre
`.git`, vos `node_modules` et votre `.env` intacts).

## Fichiers modifiés (patchés à partir de vos fichiers réels uploadés)

Vérifiés par diff exact : **uniquement des lignes ajoutées, aucune ligne
existante retirée ou changée.**

- `src/config.js` → +1 constante (`ERROR_REPORT_RETENTION_MS`)
- `src/db.js` → +1 table (`error_reports`) +1 index +1 fonction (`pruneOldErrorReports`)
- `server.js` → +2 imports enrichis, +1 ligne de montage, +1 fonction de purge périodique
- `CHANGELOG.md` → +1 entrée `## 0.3.0` en tête
- `package.json` → version `0.2.0` → `0.3.0`
- `scripts/migrate-json-to-sqlite.js` → +en-tête d'obsolescence documenté (logique strictement inchangée)

## Fichiers neufs

- `src/routes/errorReports.js`
- `src/store/errorReportsStore.js`
- `public/errors.html`
- `public/js/errors.js`

## Avant de remplacer

```bash
git checkout -b feature/error-reports-phase0
```

## Après avoir extrait ce zip par-dessus votre dossier

```bash
node --check server.js   # confirme qu'aucune erreur de syntaxe n'a été introduite
node server.js           # démarre le serveur — vérifie les logs au démarrage
```

Puis, dans un autre terminal, testez les nouveaux endpoints (remplacez
`VOTRE_CLE` par votre `DASHBOARD_API_KEY`) :

```bash
# Doit renvoyer {"ok":true}
curl -X POST http://localhost:3000/api/error-report \
  -H "Content-Type: application/json" -H "x-api-key: VOTRE_CLE" \
  -d '{"instanceId":"test","botName":"Test","version":"1.0.0","nodeVersion":"v20","errorMessage":"test manuel","errorStack":"..."}'

# Doit renvoyer 401 (pas de clé)
curl -X POST http://localhost:3000/api/error-report \
  -H "Content-Type: application/json" -d '{"instanceId":"test","errorMessage":"x"}'

# Renvoyer la MÊME requête que le premier curl une 2e fois, puis vérifier
# en base que occurrenceCount = 2 (pas 2 lignes)
```

Puis vérifiez que `heartbeat`, `instances` et `releases` fonctionnent
toujours comme avant (aucun changement ne les concerne, mais un test
rapide ne coûte rien).

## Ensuite

```bash
git add .
git commit -m "feat: réception des rapports d'erreur (POST /api/error-report), purge 30j, page admin errors.html

- Nouvelle route POST /api/error-report (requireApiKey) + GET /api/error-reports (requireAuth+requireAdmin)
- Table error_reports avec déduplication (instanceId, errorMessage) et purge automatique 30j
- Nouvelle page admin public/errors.html
- Documentation d'obsolescence sur scripts/migrate-json-to-sqlite.js
- Version 0.2.0 -> 0.3.0"
git push origin feature/error-reports-phase0
```

Puis ouvrez une Pull Request vers `main`, relisez le diff une dernière
fois, mergez, et déployez comme d'habitude (déploiement automatique Render
si configuré, sinon déclenchement manuel).

## Point d'attention restant

`public/errors.html` utilise une classe CSS `.error-stack` (bloc
monospace pour la stack trace repliée) qui n'existe probablement pas
encore dans `public/css/style.css` — un petit ajout de style peut être
nécessaire pour un rendu propre. Le reste du style (`.release-card`,
`.commands-list`, `.hub-nav`...) réutilise des classes déjà existantes
dans le projet.
