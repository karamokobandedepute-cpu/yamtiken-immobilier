# ============================================================================
#  DOCKERFILE BACKEND - NODE 20 ALPINE / EXPRESS / PRISMA (PORT 5002)
#  --------------------------------------------------------------------------
#  ⚠️ CORRECTION DU BUG "skips devDependencies" :
#  NODE_ENV=development FORCÉ pendant npm install, sinon Prisma CLI (devDep)
#  est omis par npm → "npx prisma generate" introuvable.
#
#  ⚠️ ANTI-COOLIFY : 35 ARGs déclarés explicitement
# ============================================================================

FROM node:20-alpine

# ----------------------------------------------------------------------------
# 👉 ANTI-COOLIFY : liste complète des ARGs
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

# Étape 1 : compilateurs (prisma + bcrypt native) → virés en fin pour alléger
RUN apk add --no-cache --virtual .build-deps python3 make g++ 2>&1 | tail -3 ; \
    apk add --no-cache libc6-compat openssl curl wget 2>&1 | tail -3 ; \
    echo "[OK SYSTÈME] Outils installés"

# ENV PAR DÉFAUT runtime (override Coolify au lancement du conteneur)
ENV NODE_ENV=${NODE_ENV:-production} \
    PORT=${PORT:-5002}

COPY package*.json ./

# --------------------------------------------------------------------------
#  Étape 2 : npm install — FORCAGE NODE_ENV=development
#  Prisma CLI ("prisma") est dans devDependencies → sans ceci il disparaît.
# --------------------------------------------------------------------------
RUN echo "===== npm install (FORCE NODE_ENV=development, --include=dev) =====" ; \
    OK=0 ; \
    NODE_ENV=development npm install --include=dev --legacy-peer-deps \
        --no-audit --no-fund --ignore-scripts 2>&1 | tail -12 && OK=1 ; \
    if [ $OK -eq 0 ]; then \
      echo "[RETRY 2] cache clean + install" ; \
      npm cache clean --force 2>/dev/null ; \
      NODE_ENV=development npm install --include=dev --legacy-peer-deps \
          --no-audit --no-fund --ignore-scripts --no-optional 2>&1 | tail -12 && OK=1 ; \
    fi ; \
    if [ $OK -eq 0 ]; then \
      echo "[RETRY 3] install minimum + prisma CLI" ; \
      NODE_ENV=development npm install --include=dev \
          express cors dotenv express-rate-limit express-validator helmet \
          jsonwebtoken multer xss-clean bcryptjs bcrypt @prisma/client@5 prisma@5 \
          socket.io winston exceljs pdfkit nodemailer node-cron node-cache zod \
          axios compression \
          --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -12 && OK=1 ; \
    fi ; \
    echo "--- Check post-install ---" ; \
    echo "node_modules : $(du -sh node_modules 2>/dev/null | cut -f1)" ; \
    test -d node_modules || (echo "[FATAL] node_modules absent" && exit 1) ; \
    if [ -x node_modules/.bin/prisma ]; then echo "[OK] prisma CLI (local): $(node_modules/.bin/prisma --version 2>&1 | head -1)" ; \
      else echo "[WARN] prisma CLI local absent — utilise npx"; fi

COPY . .

# --------------------------------------------------------------------------
#  Étape 3 : PRISMA GENERATE (placeholder DATABASE_URL obligatoire même pour generate)
# --------------------------------------------------------------------------
ENV DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public&connect_timeout=30}
ENV DIRECT_URL=${DIRECT_URL:-${DATABASE_URL}}

RUN echo "[PRISMA] Génération @prisma/client à partir de prisma/schema.prisma" ; \
    OK=0 ; \
    (npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tail -12) && OK=1 ; \
    if [ $OK -eq 0 ]; then \
      echo "[RETRY PRISMA 2/2]" ; \
      (npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tail -15) && OK=1 ; \
    fi ; \
    test -d node_modules/@prisma/client || (echo "[FATAL] Prisma generate échoué — @prisma/client absent" && exit 1) ; \
    echo "[OK PRISMA] @prisma/client généré"

# Étape 4 : dossiers obligatoires (sinon crash multer / winston au démarrage)
RUN mkdir -p ./uploads ./logs ./sauvegardes ./prisma ; \
    touch ./uploads/.keep ./logs/.keep 2>/dev/null ; \
    echo "[OK DOSSIERS] uploads/ logs/ présents"

# Étape 5 : nettoyage compilateurs
RUN apk del .build-deps 2>/dev/null ; rm -f /tmp/*.log 2>/dev/null ; echo "[OK NETTOYAGE]"

EXPOSE 5002

HEALTHCHECK --interval=25s --timeout=6s --retries=5 --start-period=35s \
  CMD (wget -qO- --spider "http://127.0.0.1:${PORT:-5002}/api/health" 2>/dev/null) \
   || (curl -fsS         "http://127.0.0.1:${PORT:-5002}/health"      2>/dev/null) \
   || exit 1

# Démarrage intelligent (2 emplacements possibles de server.js)
CMD ["sh", "-c", "\
  echo '========================================' ; \
  echo '  BACKEND YAMTIKEN IMMOBILIER API'     ; \
  echo '  PORT      = '${PORT:-5002}          ; \
  echo '  NODE_ENV  = '${NODE_ENV}            ; \
  echo '========================================' ; \
  if [ -f server.js ]; then exec node server.js ; \
  elif [ -f server/server.js ]; then exec node server/server.js ; \
  else echo '[FATAL] server.js introuvable — abandon'; exit 1; fi"]
