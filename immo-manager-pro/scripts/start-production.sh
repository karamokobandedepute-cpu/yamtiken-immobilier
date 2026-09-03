#!/bin/bash
# 🚀 Script de lancement Production VPS

set -e

PROJECT_DIR="/var/www/immo-manager-pro"
LOG_DIR="$PROJECT_DIR/logs"

echo "🚀 Démarrage Immo Manager Pro - Production"
echo "=========================================="

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Aller dans le dossier
cd $PROJECT_DIR

# 2. Créer le dossier logs
mkdir -p $LOG_DIR

# 3. Charger les variables d'environnement
echo -e "${GREEN}📋 Chargement des variables d'environnement...${NC}"
if [ -f "$PROJECT_DIR/server/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/server/.env" | xargs)
    echo -e "${GREEN}✅ Variables chargées${NC}"
else
    echo -e "${RED}❌ Fichier .env non trouvé!${NC}"
    exit 1
fi

# 4. Arrêter les anciens processus
echo -e "${GREEN}🛑 Arrêt des processus existants...${NC}"
pm2 delete immo-manager-backend 2>/dev/null || true
pm2 delete immo-manager-frontend 2>/dev/null || true
sleep 2

# 5. Lancer le Backend
echo -e "${GREEN}🔥 Démarrage Backend (Port 5000)...${NC}"
cd $PROJECT_DIR/server
pm2 start server.js \
    --name immo-manager-backend \
    --log $LOG_DIR/backend.log \
    --error $LOG_DIR/backend-error.log \
    --output $LOG_DIR/backend-out.log \
    --env production \
    --max-memory-restart 1G \
    --restart-delay 3000 \
    --max-restarts 5

# Attendre que le backend démarre
sleep 3

# 6. Vérifier que le backend est up
echo -e "${GREEN}🔍 Vérification Backend...${NC}"
for i in {1..5}; do
    if curl -s http://127.0.0.1:5000/health > /dev/null; then
        echo -e "${GREEN}✅ Backend opérationnel!${NC}"
        break
    else
        echo -e "${RED}⏳ Tentative $i/5...${NC}"
        sleep 2
    fi
done

# 7. Lancer le Frontend (via serve)
echo -e "${GREEN}🎨 Démarrage Frontend...${NC}"
cd $PROJECT_DIR/client
pm2 start serve \
    --name immo-manager-frontend \
    -- -s dist -l 5173 \
    --log $LOG_DIR/frontend.log \
    --error $LOG_DIR/frontend-error.log \
    --output $LOG_DIR/frontend-out.log

# 8. Sauvegarder la configuration PM2
echo -e "${GREEN}💾 Sauvegarde configuration PM2...${NC}"
pm2 save

# 9. Afficher le statut
echo -e "\n${GREEN}==========================================${NC}"
echo -e "${GREEN}✅ APPLICATION DÉMARRÉE!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "📊 Statut:"
pm2 status
echo ""
echo "🌐 Accès:"
echo "   Frontend: https://yamtiken2026.online"
echo "   API:      https://yamtiken2026.online/api"
echo "   Backend:  http://127.0.0.1:5000"
echo ""
echo "📋 Logs:"
echo "   pm2 logs"
echo ""
echo "🛑 Arrêter:"
echo "   pm2 stop all"
echo ""
echo "🔄 Redémarrer:"
echo "   pm2 restart all"
