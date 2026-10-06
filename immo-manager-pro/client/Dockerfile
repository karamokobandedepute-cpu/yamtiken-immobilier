# ============================================================
# DOCKERFILE FRONTEND - VITE + REACT
# Optimisé pour la production avec Nginx
# ============================================================

# ÉTAPE 1 : Build
FROM node:20-alpine AS build

WORKDIR /app

# Installation d'outils de base (curl) pour debug si besoin
RUN apk add --no-cache curl

# Copie des fichiers de dépendances (verrouillage de version)
COPY package*.json ./

# INSTALL INCASSABLE : legacy-peer-deps + PAS de --omit=dev (Vite est devDep !)
# Vérification explicite que vite est installé ensuite (sinon code 127)
RUN npm install --legacy-peer-deps --no-audit --no-fund \
    && ls node_modules/.bin/vite 2>/dev/null || npm install -g vite@5

# ARG pour Vite (injectés AU BUILD TIME — obligatoires pour Supabase Realtime)
# ⚠️ NE PAS RAJOUTER PUBLISHABLE_KEY ici - elle n'existe pas dans le code (cassera le build si présente)
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copie du code source
COPY . .

# Build de l'application - Affiche clairement les erreurs et set -e
RUN set -eux ; \
    echo "=== VITE_ variables injectées au build ===" ; \
    echo "VITE_API_URL=$VITE_API_URL" ; \
    echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" ; \
    echo "VITE_SUPABASE_ANON_KEY=$(echo $VITE_SUPABASE_ANON_KEY | cut -c1-30)..." ; \
    ls node_modules/.bin/vite ; \
    npm run build 2>&1 | tail -50

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
