#!/bin/bash
# 🎯 Script de vérification Backend VPS

echo "🔍 Vérification du Backend Immo Manager Pro"
echo "============================================"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Vérifier si le port 5000 est écouté
echo -e "\n${YELLOW}1. Vérification du port 5000...${NC}"
if lsof -i :5000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 5000: EN ÉCOUTE${NC}"
    lsof -i :5000 | grep LISTEN
else
    echo -e "${RED}❌ Port 5000: NON ÉCOUTÉ${NC}"
fi

# 2. Vérifier les processus PM2
echo -e "\n${YELLOW}2. Statut PM2...${NC}"
pm2 status

# 3. Vérifier les logs récents
echo -e "\n${YELLOW}3. Dernières lignes de logs...${NC}"
pm2 logs --lines 10

# 4. Tester l'API
echo -e "\n${YELLOW}4. Test API Health...${NC}"
if curl -s http://127.0.0.1:5000/health > /dev/null; then
    echo -e "${GREEN}✅ API répond (localhost:5000)${NC}"
else
    echo -e "${RED}❌ API ne répond pas${NC}"
fi

# 5. Tester via Nginx
echo -e "\n${YELLOW}5. Test via Nginx (/api)...${NC}"
if curl -s http://127.0.0.1/api/health > /dev/null; then
    echo -e "${GREEN}✅ Nginx proxy fonctionne${NC}"
else
    echo -e "${RED}❌ Nginx proxy ne fonctionne pas${NC}"
fi

echo -e "\n${YELLOW}============================================${NC}"
