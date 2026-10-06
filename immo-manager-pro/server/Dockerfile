# ============================================================================
#  DOCKERFILE BACKEND - NODE 20 / EXPRESS / PRISMA / PORT 5002
# ============================================================================
FROM node:20-alpine

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

# Compilateurs temporaires pour Prisma/bcrypt, retirés à la fin
RUN apk add --no-cache --virtual .build-deps python3 make g++ 2>&1 | tail -3 ; \
    apk add --no-cache libc6-compat openssl curl wget 2>&1 | tail -3 ; \
    echo "[OK SYSTÈME]"

ENV NODE_ENV=${NODE_ENV:-production} PORT=${PORT:-5002}

COPY package*.json ./

# ⚠️ npm install : NODE_ENV=development --include=dev pour ne PAS sauter Prisma CLI (devDep)
RUN echo "===== npm install (FORCE NODE_ENV=development, --include=dev) =====" ; \
    OK=0 ; \
    NODE_ENV=development npm install --include=dev --legacy-peer-deps --no-audit --no-fund --ignore-scripts 2>&1 | tail -12 && OK=1 ; \
    if [ $OK -eq 0 ]; then \
      npm cache clean --force 2>/dev/null ; \
      NODE_ENV=development npm install --include=dev --legacy-peer-deps --no-audit --no-fund --ignore-scripts --no-optional 2>&1 | tail -12 && OK=1 ; \
    fi ; \
    if [ $OK -eq 0 ]; then \
      NODE_ENV=development npm install --include=dev express cors dotenv express-rate-limit express-validator helmet jsonwebtoken multer xss-clean bcryptjs bcrypt @prisma/client@5 prisma@5 socket.io winston exceljs pdfkit nodemailer node-cron node-cache zod axios compression --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -12 && OK=1 ; \
    fi ; \
    test -d node_modules || (echo "[FATAL] node_modules absent"; exit 1) ; \
    echo "[OK node_modules: $(du -sh node_modules 2>/dev/null | cut -f1)]"

COPY . .

# Placeholder DATABASE_URL valide pour prisma generate (la VRAIE est Coolify runtime)
ENV DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public&connect_timeout=30}
ENV DIRECT_URL=${DIRECT_URL:-${DATABASE_URL}}

RUN echo "[PRISMA] generate..." ; \
    OK=0 ; \
    (npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tail -12) && OK=1 ; \
    if [ $OK -eq 0 ]; then (npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tail -15) && OK=1 ; fi ; \
    test -d node_modules/@prisma/client || (echo "[FATAL Prisma]" ; exit 1) ; \
    echo "[OK Prisma] @prisma/client généré"

RUN mkdir -p ./uploads ./logs ./sauvegardes ./prisma ; touch ./uploads/.keep ./logs/.keep 2>/dev/null
RUN apk del .build-deps 2>/dev/null ; rm -f /tmp/*.log 2>/dev/null ; echo "[NETTOYAGE OK]"

EXPOSE 5002

# ⚠️ Healthcheck : 90s start_period (temps boot Prisma + bootstrap admin)
#    retries=10 + interval=30s = 390s de tolérance. Jamais "unhealthy" en boot normal
HEALTHCHECK --interval=30s --timeout=8s --retries=10 --start-period=90s \
  CMD (wget -qO- --spider "http://127.0.0.1:${PORT:-5002}/api/health" >/dev/null 2>&1) \
   || (curl -fsS "http://127.0.0.1:${PORT:-5002}/health"         >/dev/null 2>&1) \
   || exit 1

# Démarrage : server.js dans WORKDIR /app
CMD ["sh", "-c", "\
  echo '========================================' ; \
  echo '  BACKEND YAMTIKEN IMMOBILIER API'     ; \
  echo '  PORT      = '${PORT:-5002}          ; \
  echo '  NODE_ENV  = '${NODE_ENV}            ; \
  DB_PRESENT=''; [ -n \"${DATABASE_URL##*placeholder*}\" ] && DB_PRESENT=1 ; \
  [ -n \"${DATABASE_URL##*postgres:postgres*}\" ] && DB_PRESENT=1 ; \
  [ -z \"$DB_PRESENT\" ] && echo '  ⚠️  DATABASE_URL: placeholder (Coolify non renseignée ?)' || echo '  DATABASE_URL: configurée' ; \
  echo '========================================' ; \
  exec node server.js"]
