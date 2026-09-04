# ============================================================
# DOCKERFILE FRONTEND - VITE + REACT
# Optimisé pour la production avec Nginx
# ============================================================

# ÉTAPE 1 : Build
FROM node:20-alpine AS build

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./
RUN npm install

# Copie du code source
COPY . .

# Build de l'application
RUN npm run build

# ÉTAPE 2 : Production
FROM nginx:alpine

# Copie de la configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers compilés depuis l'étape de build
COPY --from=build /app/dist /usr/share/nginx/html

# Création du dossier logs (pour le volume)
RUN mkdir -p /app/logs

# Port exposé (le port doit correspondre à nginx.conf et docker-compose)
EXPOSE 80

# Health check
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80 || exit 1

# Lancement de Nginx
CMD ["nginx", "-g", "daemon off;"]
