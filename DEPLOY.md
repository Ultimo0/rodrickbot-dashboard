# Déployer Rodrick Hub sur Railway

Ce guide déploie **uniquement** `dashbord-serveur/` (le Hub). RodrickBOT lui-même
(le bot WhatsApp) reste un projet séparé — voir la note en bas de page.

Fichiers déjà préparés dans ce dossier :
- `Dockerfile` — build reproductible (Node 20 + outils de compilation pour
  `better-sqlite3`, au cas où le binaire précompilé ne conviendrait pas).
- `.dockerignore` — évite de copier `node_modules/`, `data/` et `.env` dans l'image.

## 0. Prérequis

- Un compte GitHub (gratuit).
- Un compte [Railway](https://railway.app) (gratuit à la création — un essai
  avec crédit offert, puis facturation à l'usage si tu dépasses le crédit ;
  pour un petit dashboard comme celui-ci, ça reste très bon marché).

## 1. Mettre le code sur GitHub

```bash
cd dashbord-serveur
git init
git add .
git commit -m "Initial commit — Rodrick Hub"
```

Crée un nouveau dépôt (public ou privé, les deux fonctionnent) sur GitHub,
puis :

```bash
git remote add origin https://github.com/<ton-compte>/rodrick-hub.git
git branch -M main
git push -u origin main
```

> Si tu gardes `rodrickbot` et `dashbord-serveur` dans le **même** dépôt
> (monorepo), pousse-le tel quel — à l'étape 3 tu diras à Railway que la
> racine du service est le sous-dossier `dashbord-serveur/`.

## 2. Créer le projet Railway

1. Sur [railway.app](https://railway.app), **New Project** → **Deploy from
   GitHub repo** → sélectionne ton dépôt.
2. Si c'est un monorepo : dans **Settings** du service créé → **Source** →
   **Root Directory**, mets `dashbord-serveur`.
3. Railway détecte automatiquement le `Dockerfile` et l'utilise pour le
   build (pas besoin de configurer un builder manuellement).

## 3. Ajouter un volume persistant (obligatoire)

Sans ça, **la base SQLite (comptes, instances, releases, publications) est
effacée à chaque redéploiement.**

Dans le service Railway → onglet **Volumes** → **Add Volume** :
- Mount path : `/app/data`

C'est tout — `src/config.js` écrit déjà `data/hub.db` à cet emplacement
exact relatif à la racine du projet.

## 4. Variables d'environnement

Dans le service Railway → onglet **Variables**, ajoute :

| Variable | Valeur |
|---|---|
| `DASHBOARD_API_KEY` | Une chaîne longue et aléatoire (voir commande ci-dessous) |
| `SESSION_SECRET` | Une AUTRE chaîne longue et aléatoire, différente de la précédente |

Génère chaque valeur sur ta machine (jamais la même valeur pour les deux,
jamais une valeur devinable) :

```bash
openssl rand -hex 32
```

Ne mets **pas** de variable `PORT` — Railway l'injecte automatiquement, et
`src/config.js` la lit déjà (`process.env.PORT`).

## 5. Générer le sous-domaine public gratuit

Onglet **Settings** → **Networking** → **Generate Domain**.

Railway attribue une adresse du type `rodrick-hub-production.up.railway.app`,
**en HTTPS automatiquement** (certificat géré par Railway, rien à configurer).
C'est cette adresse qui rend le Hub accessible à tout le monde.

## 6. Déployer

Le premier déploiement se lance automatiquement après l'étape 2. Les suivants
se déclenchent à chaque `git push` sur la branche `main`. Suis les logs de
build dans l'onglet **Deployments** — le démarrage réussi affiche :

```
Rodrick Hub en écoute sur le port 3000 (HTTP + WebSocket)
```

## 7. ⚠️ Étape immédiate après la mise en ligne : créer le compte admin

**Le tout premier compte créé sur `/register.html` devient automatiquement
administrateur** (`src/store/usersStore.js`) — tous les suivants sont de
simples utilisateurs. Comme le site est public dès la génération du
domaine, va créer ce premier compte **toi-même, tout de suite**, avant que
qui que ce soit d'autre ne tombe sur l'URL.

Ensuite, connecte-toi et vérifie l'accès à `/admin.html`.

## 8. Relier tes instances RodrickBOT au Hub

Dans `src/config/settings.json` de chaque installation RodrickBOT, renseigne :
- `telemetryUrl` → l'URL Railway générée à l'étape 5 (+ le chemin d'API concerné)
- `telemetryApiKey` → la même valeur que `DASHBOARD_API_KEY` définie à l'étape 4

C'est ce qui permet aux heartbeats du bot d'apparaître dans le tableau de bord.

## 9. (Optionnel) Peupler le catalogue de commandes

Le catalogue affiché sur `/commands.html` vient de la table SQLite `commands`,
remplie par `scripts/generate-commands.js`, pas du fichier legacy
`data/commands.json`. Sur un déploiement neuf, cette table est vide tant que
tu n'as pas lancé une fois, avec le CLI Railway installé et lié au projet :

```bash
railway run node scripts/generate-commands.js /chemin/local/vers/rodrickbot/src/commands
```

(le dossier `src/commands` de RodrickBOT doit être accessible localement au
moment où tu lances cette commande).

## Sécurité & maintenance — points à ne pas négliger

- **Sauvegardes** : Railway ne fait pas de sauvegarde automatique du volume.
  Programme un export périodique de `data/hub.db` (ex: `railway run cat
  data/hub.db > backup-$(date +%F).db` depuis ta machine, à intervalle
  régulier) — surtout avant tout changement de plan ou migration.
- **Secrets** : `DASHBOARD_API_KEY` et `SESSION_SECRET` ne doivent jamais
  être committés dans Git — ils vivent uniquement dans les Variables Railway
  (déjà le cas ici, `.env` est dans `.gitignore` et `.dockerignore`).
- **WebSocket** : fonctionne sans configuration supplémentaire — Railway
  exécute un vrai conteneur persistant (contrairement à une plateforme
  serverless), donc `ws` garde ses connexions ouvertes normalement.
- **Alternative sans Railway** : si tu changes d'avis, Render et Fly.io
  acceptent tous les deux ce même `Dockerfile` tel quel (Render : disque
  persistant payant dès le plan de base ; Fly.io : volumes gratuits dans une
  certaine limite). La logique des étapes 3-5 reste la même, seule
  l'interface change.

## Ce qui N'EST PAS couvert par ce guide

Ce guide déploie le **Hub** (dashboard central). Le **bot WhatsApp
RodrickBOT** lui-même (`rodrickbot_settings/rodrickbot`) est un processus à
part qui doit rester connecté en continu à un compte WhatsApp — il se déploie
séparément (typiquement sur un VPS avec process manager comme `pm2`, plutôt
que sur une PaaS qui peut redémarrer le conteneur et casser la session
Baileys). Dis-moi si tu veux ce guide aussi.
