# ============================================================
# DOCKERFILE BACKEND - NODE.JS API
# Optimisé pour le développement avec hot reload
# ============================================================
FROM node:20-alpine

# Installation des dépendances système
RUN apk add --no-cache wget curl openssl

# Création du répertoire de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code
COPY . .

# Génération du client Prisma pour l'environnement Linux Alpine
RUN npx prisma generate

# Création du dossier logs
RUN mkdir -p logs

# Port exposé
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5002/api/health || exit 1

# Commande de démarrage directe
CMD ["node", "server.js"]
