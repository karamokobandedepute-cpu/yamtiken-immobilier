#!/bin/bash
# ============================================
# IMMO MANAGER PRO - DÉPLOIEMENT VPS COMPLET
# Site : yamtiken2026.online
# Usage : bash deploy-production.sh
# ============================================

set -e  # Arrête si une commande échoue

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
err()  { echo -e "${RED}  ❌ $1${NC}"; exit 1; }

APP_DIR="/var/www/immo-manager-pro"
SERVER_DIR="$APP_DIR/server"
CLIENT_DIR="$APP_DIR/client"
LOG_DIR="$APP_DIR/logs"

echo ""
echo "==========================================="
echo "  🏢 IMMO MANAGER PRO - Déploiement VPS"
echo "  $(date)"
echo "==========================================="
echo ""

# ─── VÉRIFICATIONS PRÉALABLES ───────────────
echo "[0/7] Vérifications préalables..."

command -v node >/dev/null 2>&1 || err "Node.js non installé. Installer avec: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs"
command -v pm2  >/dev/null 2>&1 || err "PM2 non installé. Installer avec: npm install -g pm2"

[ -f "$SERVER_DIR/.env" ] || err "Fichier .env manquant dans $SERVER_DIR/.env\nCrée-le avec le contenu de ENV_VPS_FINAL.txt (lignes 2-16)"
ok "Node.js $(node -v) trouvé"
ok "PM2 trouvé"
ok "Fichier .env trouvé"

# ─── DOSSIERS REQUIS ────────────────────────
echo ""
echo "[1/7] Création des dossiers requis..."
mkdir -p "$LOG_DIR"
mkdir -p "$SERVER_DIR/uploads/photos"
mkdir -p "$SERVER_DIR/uploads/documents"
chmod -R 755 "$SERVER_DIR/uploads"
ok "Dossiers créés"

# ─── DÉPENDANCES SERVEUR ────────────────────
echo ""
echo "[2/7] Installation dépendances backend..."
cd "$SERVER_DIR"
npm install --omit=dev
ok "Dépendances backend OK"

# ─── PRISMA GENERATE ────────────────────────
echo ""
echo "[3/7] Génération client Prisma..."
cd "$SERVER_DIR"
npx prisma generate
ok "Prisma client généré"

# ─── BUILD FRONTEND ─────────────────────────
echo ""
echo "[4/7] Build du frontend React..."
cd "$CLIENT_DIR"
# Créer .env.production si inexistant
if [ ! -f ".env.production" ]; then
  echo "VITE_API_URL=/api" > .env.production
  warn ".env.production créé avec VITE_API_URL=/api"
fi
npm install
npm run build
ok "Frontend buildé dans client/dist"

# ─── PM2 : DÉMARRAGE ROBUSTE ────────────────
echo ""
echo "[5/7] Configuration PM2..."
cd "$APP_DIR"

# Arrêter l'ancienne instance si elle existe
pm2 delete immo-manager-backend 2>/dev/null && warn "Ancienne instance PM2 supprimée" || true

# Démarrer avec toutes les vars d'env du .env
pm2 start "$SERVER_DIR/server.js" \
  --name "immo-manager-backend" \
  --cwd "$SERVER_DIR" \
  --node-args="--max-old-space-size=512" \
  --env production \
  --log "$LOG_DIR/backend.log" \
  --output "$LOG_DIR/backend-out.log" \
  --error "$LOG_DIR/backend-error.log" \
  --time \
  --restart-delay=3000 \
  --max-restarts=10

ok "PM2 démarré"

# ─── PM2 SURVIE AU REBOOT ───────────────────
echo ""
echo "[6/7] PM2 startup (survie reboot VPS)..."
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || warn "pm2 startup déjà configuré ou nécessite sudo manuel"
ok "PM2 sauvegardé"

# ─── NGINX RELOAD ───────────────────────────
echo ""
echo "[7/7] Rechargement Nginx..."
if command -v nginx >/dev/null 2>&1; then
  cp "$APP_DIR/nginx-yamtiken2026.conf" /etc/nginx/sites-available/yamtiken2026 2>/dev/null || true
  ln -sf /etc/nginx/sites-available/yamtiken2026 /etc/nginx/sites-enabled/ 2>/dev/null || true
  nginx -t && systemctl reload nginx && ok "Nginx rechargé" || warn "Nginx config à vérifier manuellement"
else
  warn "Nginx non trouvé - vérifier installation"
fi

# ─── VÉRIFICATION FINALE ────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "  Test health check..."
sleep 3
HEALTH=$(curl -sf http://localhost:5000/api/health 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "OK"; then
  ok "API répond sur localhost:5000"
else
  warn "API pas encore prête - vérifier: pm2 logs immo-manager-backend"
fi

echo ""
echo "==========================================="
echo -e "${GREEN}  ✅ DÉPLOIEMENT TERMINÉ !${NC}"
echo "  API Health : http://localhost:5000/api/health"
echo "  Site       : https://yamtiken2026.online"
echo "  Logs       : pm2 logs immo-manager-backend"
echo "  Statut     : pm2 status"
echo "==========================================="
echo ""
