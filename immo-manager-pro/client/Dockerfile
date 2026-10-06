# ============================================================================
#  DOCKERFILE FRONTEND - VITE + REACT + NGINX ALPINE (PROD)
#  --------------------------------------------------------------------------
#  ⚠️ CORRECTION DÉFINITIVE DU BUG "skips devDependencies" :
#  On force NODE_ENV=development PENDANT npm install (malgré Coolify)
#  car npm met --omit=dev AUTOMATIQUEMENT quand NODE_ENV=production
#  → VITE/Tailwind/PostCSS sont dans devDependencies, ça planter sinon.
#
#  ⚠️ ANTI-COOLIFY-INJECTION :
#  La liste EXACTE des 35 ARGs Coolify est déclarée DANS CHAQUE STAGE
#  → Coolify n'affiche plus "Added 70 ARG declarations"
# ============================================================================

# ============================================================
#  STAGE 1/2 : BUILD (Node 20 Alpine — compilation Vite React)
# ============================================================
FROM node:20-alpine AS build

# ----------------------------------------------------------------------------
# 👉 ANTI-COOLIFY : tous les ARGs du --build-arg de Coolify, déclarés ici
# ----------------------------------------------------------------------------
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

# --------------------------------------------------------------------------
#  Étape 1/6 : ÉLAGAGE DES DÉPENDANCES LOURDES (INCOMPATIBLES AVEC ALPINE)
#  Electron / Capacitor Android = binaires glibc, Alpine = musl libc → CRASH
# --------------------------------------------------------------------------
RUN node -e '\
const fs=require("fs"), p=JSON.parse(fs.readFileSync("./package.json"));\
["@capacitor/android","@capacitor/cli","@capacitor/core",\
 "electron","electron-builder","electron-serve"].forEach(k=>{\
  if(p.dependencies) delete p.dependencies[k];\
  if(p.devDependencies) delete p.devDependencies[k];});\
fs.writeFileSync("./package.json",JSON.stringify(p,null,2));\
console.log("[PRUNE OK] Electron/Capacitor retirés");'

# --------------------------------------------------------------------------
#  Étape 2/6 : npm install — FORCAGE DE NODE_ENV=development (RACINE DU BUG)
#  Même si Coolify passe NODE_ENV=production, on override ici pour que npm
#  n'omette PAS les devDependencies (vite, tailwind, postcss, @vitejs/plugin, etc.)
# --------------------------------------------------------------------------
RUN echo "===== npm install (FORCE NODE_ENV=development) =====" ; \
    OK=0 ; \
    # ⚠️ NODE_ENV=development explicit avant npm install dans chaque appel
    NODE_ENV=development npm install --include=dev --legacy-peer-deps \
        --no-audit --no-fund --ignore-scripts 2>&1 | tail -15 && OK=1 ; \
    if [ $OK -eq 0 ]; then \
      echo "[RETRY 2] cache clean" ; \
      npm cache clean --force 2>/dev/null ; \
      NODE_ENV=development npm install --include=dev --legacy-peer-deps \
          --no-audit --no-fund --ignore-scripts 2>&1 | tail -15 && OK=1 ; \
    fi ; \
    if [ $OK -eq 0 ]; then \
      echo "[RETRY 3] install minimal Vite stack" ; \
      NODE_ENV=development npm install --include=dev \
          vite@5 @vitejs/plugin-react react@18 react-dom@18 \
          postcss autoprefixer tailwindcss@3 terser cross-env \
          --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -15 && OK=1 ; \
    fi ; \
    # ⚠️ FALLBACK ABSOLU : installer vite GLOBALEMENT (n'importe où) puis symlink
    if [ ! -x node_modules/.bin/vite ]; then \
      echo "[FALLBACK] vite global + symlink" ; \
      npm install -g vite@5 --no-audit --no-fund --silent ; \
      mkdir -p node_modules/.bin ; \
      ln -sf "$(which vite)" node_modules/.bin/vite 2>/dev/null || true ; \
    fi ; \
    echo "--- Check post-install ---" ; \
    echo "node_modules : $(du -sh node_modules 2>/dev/null | cut -f1)" ; \
    if   [ -x node_modules/.bin/vite ];   then echo "[OK] vite local : $(node_modules/.bin/vite --version 2>&1)" ; \
    elif [ -x "$(command -v vite)" ];     then echo "[OK] vite global: $(vite --version 2>&1)" ; \
    else echo "[FATAL] vite est introuvable — abandon du build"; exit 1 ; fi ; \
    if [ -x node_modules/.bin/tailwind ]; then echo "[OK] tailwind local"; else echo "[WARN] tailwind absent — tente inline fallback"; fi

# --------------------------------------------------------------------------
#  Étape 3/6 : ENV que Vite substitue dans le bundle (import.meta.env.VITE_*)
#  Ici on REVIENT à NODE_ENV=production pour générer un bundle optimisé.
# --------------------------------------------------------------------------
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    NODE_ENV=production

COPY . .

# --------------------------------------------------------------------------
#  Étape 4/6 : VITE BUILD — 2 tentatives avec logs TOTAUX en échec
# --------------------------------------------------------------------------
RUN echo "" ; \
    echo "===== VITE VARIABLES (BUILD TIME) =====" ; \
    echo "  VITE_API_URL              = ${VITE_API_URL:-<MISSING - A AJOUTER DANS BUILD ARGS>}" ; \
    echo "  VITE_SUPABASE_URL         = ${VITE_SUPABASE_URL:-<MISSING>}" ; \
    K="${VITE_SUPABASE_ANON_KEY}";     echo "  VITE_SUPABASE_ANON_KEY    = ${K:0:24}... (${#K}c)" ; \
    P="${VITE_SUPABASE_PUBLISHABLE_KEY}"; echo "  VITE_SUPABASE_PUBLISHABLE = ${P:0:24}... (${#P}c)" ; \
    echo "  NODE_ENV (build)          = ${NODE_ENV}" ; \
    echo "======================================" ; \
    BUILT=0 ; \
    if npm run build >/tmp/v1.log 2>&1; then BUILT=1; echo "[OK BUILD T1] Vite build réussi"; fi ; \
    if [ $BUILT -eq 0 ]; then \
      echo "[FAIL T1] tail 60 :" ; tail -60 /tmp/v1.log ; \
      echo "--- VITE BUILD RETRY 2/2 ---" ; \
      if npx vite build >/tmp/v2.log 2>&1; then BUILT=1; echo "[OK BUILD T2] réussi"; \
      else echo "[FAIL T2] tail 120 :" ; tail -120 /tmp/v2.log ; fi ; \
    fi ; \
    if [ $BUILT -eq 1 ] && [ -f dist/index.html ]; then \
      echo "[OK] dist/index.html = $(wc -c <dist/index.html) octets. Assets:" ; \
      ls -1 dist/assets 2>/dev/null | head -10 ; \
    else \
      echo "[FATAL BUILD] dist/index.html introuvable" ; \
      echo "--- LOG COMPLET t1 TAIL 150 ---" ; tail -150 /tmp/v1.log 2>/dev/null ; \
      exit 1 ; \
    fi

# ============================================================
#  STAGE 2/2 : RUNTIME — NGINX ALPINE (sert le bundle dist/)
# ============================================================
FROM nginx:alpine

# ----------------------------------------------------------------------------
# 👉 ANTI-COOLIFY : même liste ARGs que stage build pour stage Nginx
# ----------------------------------------------------------------------------
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

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=20s \
  CMD wget -qO- --spider http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
