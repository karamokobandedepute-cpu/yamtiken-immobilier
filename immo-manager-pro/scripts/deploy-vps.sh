#!/bin/bash
# 🚀 SCRIPT DÉPLOIEMENT AUTOMATIQUE VPS
# IP: 54.36.209.70

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement Immo Manager Pro sur VPS 54.36.209.70"
echo "==================================================="

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Mise à jour système
echo -e "${GREEN}1. Mise à jour système...${NC}"
apt update && apt upgrade -y

# 2. Installation Node.js et dépendances
echo -e "${GREEN}2. Installation Node.js...${NC}"
apt install -y nodejs npm git curl

# Vérifier version Node
node_version=$(node --version)
echo "✅ Node.js installé: $node_version"

# 3. Installation PM2
echo -e "${GREEN}3. Installation PM2...${NC}"
npm install pm2 -g
pm2 --version

# 4. Installation Nginx
echo -e "${GREEN}4. Installation Nginx...${NC}"
apt install -y nginx

# 5. Création dossier projet
echo -e "${GREEN}5. Préparation dossier projet...${NC}"
mkdir -p /var/www
mkdir -p /var/www/immo-manager-pro/logs

# 6. Configuration firewall
echo -e "${GREEN}6. Configuration Firewall...${NC}"
apt install -y ufw
ufw allow 22/tcp    # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 5000/tcp # API Backend
ufw allow 5173/tcp # Frontend Dev
ufw --force enable

echo -e "${GREEN}✅ VPS Prêt !${NC}"
echo ""
echo "Prochaines étapes:"
echo "1. Transférer les fichiers du projet"
echo "2. Configurer les variables d'environnement"
echo "3. Démarrer l'application avec PM2"
echo ""
echo "IP VPS: 54.36.209.70"
echo "Backend: http://54.36.209.70:5000"
echo "Frontend: http://54.36.209.70:5173"
