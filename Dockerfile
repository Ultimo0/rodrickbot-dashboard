# pg est un client Postgres pur JavaScript (aucun module natif à
# compiler), donc plus besoin de fixer une version de Node précise ni
# d'installer d'outils de compilation comme c'était le cas avec
# better-sqlite3 — n'importe quelle image Node 20+ récente convient.
FROM node:20-bookworm-slim

WORKDIR /app

# Copié séparément du reste du code : Docker met cette étape en cache et
# ne relance "npm install" que si package.json change réellement, pas à
# chaque modification de code (build bien plus rapide en développement).
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Documentaire uniquement : la PaaS choisit le port réel via la variable
# d'environnement PORT, déjà lue par src/config.js. EXPOSE ne fait rien
# de plus que documenter l'intention pour quiconque lit ce Dockerfile.
EXPOSE 3000

CMD ["node", "server.js"]
