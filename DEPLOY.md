# Déployer Rodrick Hub — Render (gratuit) + Neon (Postgres gratuit)

Ce guide déploie **uniquement** `dashbord-serveur/` (le Hub). RodrickBOT
lui-même (le bot WhatsApp) reste un projet séparé — voir la note en bas de
page.

## Ce qui a changé par rapport à la version SQLite

L'app utilisait `better-sqlite3` (base de données dans un fichier local).
Deux problèmes rendaient ça incompatible avec Render gratuit :
1. Son module natif ne compile pas avec les toutes dernières versions de Node.
2. Render gratuit **ne permet aucun disque persistant** — un fichier SQLite
   local serait effacé à chaque redémarrage du service.

L'app utilise maintenant **Postgres via `pg`** (client 100% JavaScript, rien
à compiler), hébergé gratuitement sur **Neon** (offre permanente, pas
d'expiration, contrairement au Postgres gratuit de Render qui expire après
30 jours). Plus aucun fichier local à préserver → plus besoin de disque du
tout, donc plus de blocage lié au plan gratuit de Render.

## 0. Prérequis

- Un compte GitHub (gratuit).
- Un compte [Render](https://render.com) (gratuit).
- Un compte [Neon](https://neon.tech) (gratuit, aucune carte requise).

## 1. Créer la base Postgres sur Neon

1. Sur [neon.tech](https://neon.tech), crée un compte puis un nouveau projet
   (nom libre, ex: `rodrick-hub`).
2. Neon affiche immédiatement une **chaîne de connexion**, du type :
   ```
   postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
   ```
   Copie-la telle quelle — c'est la valeur de `DATABASE_URL` (étape 4).
3. Rien d'autre à faire ici : les tables sont créées automatiquement au
   premier démarrage du serveur (`src/db.js`, `CREATE TABLE IF NOT EXISTS`).

## 2. Mettre le code sur GitHub

```bash
cd dashbord-serveur
git init
git add .
git commit -m "Initial commit — Rodrick Hub (Postgres)"
```

Crée un dépôt sur GitHub, puis :

```bash
git remote add origin https://github.com/<ton-compte>/rodrick-hub.git
git branch -M main
git push -u origin main
```

> Monorepo avec `rodrickbot` dans le même dépôt : pousse tel quel, à
> l'étape 3 tu indiqueras à Render que la racine du service est
> `dashbord-serveur/`.

## 3. Créer le Web Service sur Render

1. Sur le dashboard Render → **New** → **Web Service** → connecte ton dépôt
   GitHub.
2. Si monorepo : **Root Directory** → `dashbord-serveur`.
3. **Runtime** : Node (Render utilise `npm install` puis `npm start`,
   définis dans `package.json`). Le `Dockerfile` fourni fonctionne aussi si
   tu préfères choisir **Runtime: Docker** — les deux marchent, aucune
   compilation native n'est plus nécessaire dans un cas comme dans l'autre.
4. **Instance Type** : Free.

## 4. Variables d'environnement

Dans le service Render → onglet **Environment** :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | La chaîne de connexion copiée depuis Neon (étape 1) |
| `DASHBOARD_API_KEY` | Une chaîne longue et aléatoire (voir commande ci-dessous) |
| `SESSION_SECRET` | Une AUTRE chaîne longue et aléatoire, différente de la précédente |

Génère chaque secret sur ta machine (jamais la même valeur pour les deux) :

```bash
openssl rand -hex 32
```

Ne mets pas de variable `PORT` — Render l'injecte automatiquement.

## 5. Déployer

Render déclenche le premier déploiement automatiquement. Dans les logs, tu
dois voir :

```
Rodrick Hub en écoute sur le port 10000 (HTTP + WebSocket)
```

sans avertissement sur `DATABASE_URL`, `DASHBOARD_API_KEY` ou
`SESSION_SECRET` manquants. Render fournit une URL publique du type
`ton-service.onrender.com`, en HTTPS automatiquement.

## 6. ⚠️ Étape immédiate après la mise en ligne : créer le compte admin

**Le tout premier compte créé sur `/register.html` devient automatiquement
administrateur** (`src/store/usersStore.js`) — tous les suivants sont de
simples utilisateurs. Le site étant public dès sa mise en ligne, crée ce
premier compte **toi-même, tout de suite**.

## 7. Relier tes instances RodrickBOT au Hub

Dans `src/config/settings.json` de chaque installation RodrickBOT :
- `telemetryUrl` → l'URL Render générée à l'étape 5
- `telemetryApiKey` → la même valeur que `DASHBOARD_API_KEY`

## 8. (Optionnel) Peupler le catalogue de commandes

Le catalogue de `/commands.html` vient de la table Postgres `commands`,
vide sur un déploiement neuf. Depuis ta machine, avec `DATABASE_URL` réglée
en local (ou en copiant temporairement la valeur de Render dans un `.env`
local) :

```bash
npm install
node scripts/generate-commands.js /chemin/local/vers/rodrickbot/src/commands
```

## 9. Photo de profil — configurer Cloudinary

Nécessaire pour que le changement de photo de profil fonctionne (`profile.html`).

1. Crée un compte gratuit sur [cloudinary.com](https://cloudinary.com) (aucune carte requise).
2. Sur le tableau de bord, note ton **Cloud name** (affiché en haut) —
   c'est la valeur de `CLOUDINARY_CLOUD_NAME`.
3. Va dans **Settings** → **Upload** → **Upload presets** → **Add upload preset** :
   - **Signing Mode** : `Unsigned` (indispensable — c'est ce qui permet au
     navigateur d'uploader directement, sans exposer ta clé secrète).
   - **Folder** : ex. `rodrick-hub-avatars` (garde les photos du Hub à part du reste du compte).
   - **Allowed formats** : `jpg, png, webp` (limite les abus).
   - Donne-lui un nom simple (ex. `rodrick_hub_avatars`) → c'est la valeur de `CLOUDINARY_UPLOAD_PRESET`.
4. Ajoute ces deux valeurs dans les variables d'environnement Render (comme `DATABASE_URL` à l'étape 4).

⚠️ **Point de sécurité à connaître** : un upload "non signé" est accessible à
quiconque connaît ton cloud name + preset (visibles dans le code du
navigateur, c'est normal et documenté par Cloudinary) — pas seulement
depuis ton Hub. Le format restreint (étape 3) limite les abus, mais si tu
veux un contrôle plus strict plus tard, un upload "signé" (généré côté
serveur) est possible — dis-le-moi si tu veux qu'on bascule dessus.

## Points à ne pas négliger

- **Mise en veille** : le plan gratuit de Render endort le service après 15
  minutes d'inactivité (environ 1 minute de réveil à la requête suivante).
  Ça ne touche plus aux données maintenant qu'elles sont sur Neon — c'est
  juste un délai de première réponse, pas une perte d'information.
- **Neon aussi se met en veille** (5 min d'inactivité), mais se réveille
  automatiquement en quelques centaines de millisecondes à la prochaine
  requête — aucune action de ta part, et les données ne sont jamais
  perdues (contrairement à un redémarrage Render sans disque).
- **Limite Neon gratuite** : 0,5 Go de stockage et 100 heures de calcul par
  mois — largement suffisant pour ce type de dashboard tant que le trafic
  reste modéré.
- **Secrets** : `DATABASE_URL`, `DASHBOARD_API_KEY` et `SESSION_SECRET` ne
  doivent jamais être committés dans Git (`.env` est dans `.gitignore`).
- **Sauvegardes** : Neon fait des sauvegardes automatiques sur son plan
  gratuit, mais vérifie les détails actuels sur leur documentation si tes
  données deviennent critiques.

## Ce qui N'EST PAS couvert par ce guide

Ce guide déploie le **Hub**. Le **bot WhatsApp RodrickBOT**
(`rodrickbot_settings/rodrickbot`) est un processus à connexion permanente
qui ne se déploie pas de la même façon (un VPS avec `pm2` convient mieux
qu'une PaaS qui peut redémarrer le conteneur et casser la session Baileys).
Dis-moi si tu veux ce guide aussi.
