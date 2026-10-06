# ============================================================================
#  DOCKERFILE FRONTEND - VITE + REACT + NGINX ALPINE (PROD)
# ============================================================================
FROM node:20-alpine AS build

# 👉 ANTI-COOLIFY : tous ARGs
ARG COOLIFY_URL
ARG COOLIFY_FQDN
ARG COOLIFY_BRANCH
ARG COOLIFY_RESOURCE_UUID
ARG COOLIFY_BUILD_SECRETS_HASH
ARG DATABASE_URL
ARG DIRECT_URL
ARG JWT_SECRET
ARG SUPABASE_URL
ARG CORS_ALLOW_ALL
ARG SUPABASE_ANON_KEY
ARG CLIENT_URL
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG SERVICE_URL_BACKEND
ARG SERVICE_FQDN_BACKEND
ARG SERVICE_URL_FRONTEND
ARG SERVICE_FQDN_FRONTEND
ARG SUPABASE_SERVICE_KEY
ARG SUPABASE_PUBLISHABLE_KEY
ARG SUPABASE_ACCESS_TOKEN
ARG SUPER_ADMIN_EMAIL
ARG SUPER_ADMIN_PASSWORD
ARG ALERT_EMAIL
ARG ALERT_REFRESH_INTERVAL
ARG GMAIL_APP_EMAIL
ARG GMAIL_APP_PASSWORD
ARG JWT_EXPIRES_IN
ARG SMTP_HOST
ARG SMTP_PORT
ARG SMTP_SECURE
ARG VPS_FRONTEND_ORIGIN
ARG VPS_API_ORIGIN
ARG NODE_ENV
ARG PORT
ARG ALLOWED_ORIGINS

WORKDIR /app
RUN apk add --no-cache --quiet curl wget git
COPY package*.json ./

# Pré-nettoyage package.json : retirer Electron/Capacitor incompatibles musl libc
RUN node -e '\
const fs=require("fs"), p=JSON.parse(fs.readFileSync("./package.json"));\
["@capacitor/android","@capacitor/cli","@capacitor/core",\
 "electron","electron-builder","electron-serve"].forEach(k=>{\
  if(p.dependencies) delete p.dependencies[k];\
  if(p.devDependencies) delete p.devDependencies[k];});\
fs.writeFileSync("./package.json",JSON.stringify(p,null,2));\
console.log("[PRUNE OK] Electron/Capacitor retirés");'

# ⚠️ npm install : NODE_ENV=development FORCÉ pour ne PAS --omit=dev
RUN echo "===== npm install (FORCE NODE_ENV=development, --include=dev) =====" ; \
    OK=0 ; \
    NODE_ENV=development npm install --include=dev --legacy-peer-deps --no-audit --no-fund --ignore-scripts 2>&1 | tail -15 && OK=1 ; \
    if [ $OK -eq 0 ]; then \
      npm cache clean --force 2>/dev/null ; \
      NODE_ENV=development npm install --include=dev --legacy-peer-deps --no-audit --no-fund --ignore-scripts 2>&1 | tail -15 && OK=1 ; \
    fi ; \
    if [ $OK -eq 0 ]; then \
      NODE_ENV=development npm install --include=dev vite@5 @vitejs/plugin-react react@18 react-dom@18 postcss autoprefixer tailwindcss@3 terser cross-env --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -15 && OK=1 ; \
    fi ; \
    if [ ! -x node_modules/.bin/vite ]; then \
      echo "[FALLBACK] vite global" ; \
      npm install -g vite@5 --no-audit --no-fund --silent ; \
      mkdir -p node_modules/.bin ; ln -sf "$(which vite)" node_modules/.bin/vite 2>/dev/null || true ; \
    fi ; \
    if   [ -x node_modules/.bin/vite ];           then echo "[OK] vite local : $(node_modules/.bin/vite --version 2>&1)" ; \
    elif [ -x "$(command -v vite)" ];             then echo "[OK] vite global: $(vite --version 2>&1)" ; \
    else echo "[FATAL] vite introuvable"; exit 1 ; fi

# Vite build : repasse NODE_ENV=production pour un bundle optimisé
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    NODE_ENV=production

COPY . .

RUN echo "===== VITE VARIABLES (BUILD TIME) =====" ; \
    echo "  VITE_API_URL              = ${VITE_API_URL:-<MISSING>}" ; \
    echo "  VITE_SUPABASE_URL         = ${VITE_SUPABASE_URL:-<MISSING>}" ; \
    K="${VITE_SUPABASE_ANON_KEY}";     echo "  VITE_SUPABASE_ANON_KEY    = ${K:0:24}...(${#K}c)" ; \
    P="${VITE_SUPABASE_PUBLISHABLE_KEY}"; echo "  VITE_SUPABASE_PUBLISHABLE = ${P:0:24}...(${#P}c)" ; \
    BUILT=0 ; \
    npm run build >/tmp/v1.log 2>&1 && BUILT=1 ; \
    if [ $BUILT -eq 0 ]; then tail -80 /tmp/v1.log ; npx vite build >/tmp/v2.log 2>&1 && BUILT=1 ; tail -120 /tmp/v2.log 2>/dev/null ; fi ; \
    if [ $BUILT -eq 1 ] && [ -f dist/index.html ]; then echo "[OK] dist/index.html ($(wc -c <dist/index.html) o)" ; \
    else echo "[FATAL BUILD]" ; tail -150 /tmp/v1.log 2>/dev/null ; exit 1 ; fi

# ------------- Stage 2/2 : Nginx runtime -------------
FROM nginx:alpine

ARG COOLIFY_URL
ARG COOLIFY_FQDN
ARG COOLIFY_BRANCH
ARG COOLIFY_RESOURCE_UUID
ARG COOLIFY_BUILD_SECRETS_HASH
ARG DATABASE_URL
ARG DIRECT_URL
ARG JWT_SECRET
ARG SUPABASE_URL
ARG CORS_ALLOW_ALL
ARG SUPABASE_ANON_KEY
ARG CLIENT_URL
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG SERVICE_URL_BACKEND
ARG SERVICE_FQDN_BACKEND
ARG SERVICE_URL_FRONTEND
ARG SERVICE_FQDN_FRONTEND
ARG SUPABASE_SERVICE_KEY
ARG SUPABASE_PUBLISHABLE_KEY
ARG SUPABASE_ACCESS_TOKEN
ARG SUPER_ADMIN_EMAIL
ARG SUPER_ADMIN_PASSWORD
ARG ALERT_EMAIL
ARG ALERT_REFRESH_INTERVAL
ARG GMAIL_APP_EMAIL
ARG GMAIL_APP_PASSWORD
ARG JWT_EXPIRES_IN
ARG SMTP_HOST
ARG SMTP_PORT
ARG SMTP_SECURE
ARG VPS_FRONTEND_ORIGIN
ARG VPS_API_ORIGIN
ARG NODE_ENV
ARG PORT
ARG ALLOWED_ORIGINS

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN mkdir -p /app/logs && chown -R nginx:nginx /usr/share/nginx/html /app/logs 2>/dev/null || true

EXPOSE 80
HEALTHCHECK --interval=45s --timeout=5s --retries=10 --start-period=30s \
  CMD wget -qO- --spider http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
