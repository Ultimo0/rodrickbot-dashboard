# Node 20 : version minimale requise par package.json ("engines").
# "slim" = image Debian allégée (pas Alpine) car better-sqlite3 compile
# plus facilement contre la glibc de Debian que contre la musl d'Alpine.
FROM node:20-bookworm-slim

# python3/make/g++ : nécessaires UNIQUEMENT si npm ne trouve pas de
# binaire précompilé pour better-sqlite3 correspondant à la plateforme
# de build et doit le recompiler depuis les sources. Les avoir présents
# rend le build fiable quelle que soit la plateforme de la PaaS.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copié séparément du reste du code : Docker met cette étape en cache et
# ne relance "npm install" que si package.json change réellement, pas à
# chaque modification de code (build bien plus rapide en développement).
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Le dossier data/ (base SQLite + fichiers persistants) doit survivre aux
# redéploiements. Sur Railway/Render/Fly.io, monte un volume persistant
# sur ce chemin exact (voir DEPLOY.md) — sans ça, chaque redéploiement
# repart d'une base vide.
RUN mkdir -p /app/data

# Documentaire uniquement : la PaaS choisit le port réel via la variable
# d'environnement PORT, déjà lue par src/config.js. EXPOSE ne fait rien
# de plus que documenter l'intention pour quiconque lit ce Dockerfile.
EXPOSE 3000

CMD ["node", "server.js"]
