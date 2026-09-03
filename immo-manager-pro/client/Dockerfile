# ============================================================
# DOCKERFILE FRONTEND - VITE + REACT
# Optimisé pour le développement avec hot reload
# ============================================================
FROM node:20-alpine

# Installation des dépendances système
RUN apk add --no-cache wget curl

# Création du répertoire de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code (sera écrasé par volume en dev)
COPY . .

# Création du dossier logs
RUN mkdir -p logs

# Port exposé
EXPOSE 5177

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5177 || exit 1

# Commande de démarrage
CMD ["npm", "run", "dev", "--", "--host", "--port", "5177"]
