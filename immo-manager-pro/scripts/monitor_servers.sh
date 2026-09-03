#!/bin/bash

# ============================================================
# SCRIPT DE SURVEILLANCE - INFRASTRUCTURE INCREVABLE
# Vérifie les ports toutes les 10s et redémarre si nécessaire
# ============================================================

# Configuration
BACKEND_PORT=5002
FRONTEND_PORT=5177
CHECK_INTERVAL=10
LOG_FILE="./logs/monitor.log"
MAX_RETRIES=3

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# FONCTIONS
# ============================================================

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $timestamp - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $timestamp - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $timestamp - $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $timestamp - $message"
            ;;
    esac
    
    # Écrire aussi dans le fichier log
    echo "[$level] $timestamp - $message" >> "$LOG_FILE"
}

# Vérifier si un port répond
check_port() {
    local port=$1
    local name=$2
    
    if nc -z localhost $port 2>/dev/null || timeout 2 bash -c "cat < /dev/null > /dev/tcp/localhost/$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Vérifier avec curl (plus fiable pour HTTP)
check_http() {
    local port=$1
    local endpoint=$2
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port$endpoint | grep -q "200\|301\|302"; then
        return 0
    else
        return 1
    fi
}

# Redémarrer un service avec PM2
restart_pm2() {
    local service=$1
    log "WARN" "Tentative de redémarrage de $service avec PM2..."
    
    if pm2 restart $service; then
        log "INFO" "$service redémarré avec succès via PM2"
        return 0
    else
        log "ERROR" "Échec du redémarrage PM2 de $service"
        return 1
    fi
}

# Redémarrer avec Docker
restart_docker() {
    local container=$1
    log "WARN" "Tentative de redémarrage de $container avec Docker..."
    
    if docker restart $container; then
        log "INFO" "$container redémarré avec succès via Docker"
        sleep 5  # Attendre que le service démarre
        return 0
    else
        log "ERROR" "Échec du redémarrage Docker de $container"
        return 1
    fi
}

# Démarrer un service si complètement arrêté
start_service() {
    local service=$1
    log "WARN" "Service $service arrêté - Démarrage..."
    
    case $service in
        "backend")
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.dev.config.js --only immo-backend
            elif command -v docker &> /dev/null; then
                docker-compose up -d backend
            else
                cd server && PORT=5002 node server.js &
            fi
            ;;
        "frontend")
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.dev.config.js --only immo-frontend
            elif command -v docker &> /dev/null; then
                docker-compose up -d frontend
            else
                cd client && npx vite --host --port 5177 &
            fi
            ;;
    esac
}

# Vérifier l'état global
check_all_services() {
    local backend_ok=false
    local frontend_ok=false
    
    # Vérifier Backend
    if check_port $BACKEND_PORT; then
        backend_ok=true
        log "DEBUG" "Backend (port $BACKEND_PORT) ✓"
    else
        log "WARN" "Backend (port $BACKEND_PORT) ✗ - Ne répond pas"
    fi
    
    # Vérifier Frontend
    if check_port $FRONTEND_PORT; then
        frontend_ok=true
        log "DEBUG" "Frontend (port $FRONTEND_PORT) ✓"
    else
        log "WARN" "Frontend (port $FRONTEND_PORT) ✗ - Ne répond pas"
    fi
    
    # Actions de redémarrage si nécessaire
    if [ "$backend_ok" = false ]; then
        log "ERROR" "CRITIQUE: Backend hors ligne !"
        
        # Essayer PM2 d'abord
        if command -v pm2 &> /dev/null && pm2 list | grep -q "immo-backend"; then
            restart_pm2 "immo-backend"
        # Sinon essayer Docker
        elif command -v docker &> /dev/null && docker ps | grep -q "immo-backend"; then
            restart_docker "immo-backend"
        # Sinon démarrer manuellement
        else
            start_service "backend"
        fi
    fi
    
    if [ "$frontend_ok" = false ]; then
        log "ERROR" "CRITIQUE: Frontend hors ligne !"
        
        if command -v pm2 &> /dev/null && pm2 list | grep -q "immo-frontend"; then
            restart_pm2 "immo-frontend"
        elif command -v docker &> /dev/null && docker ps | grep -q "immo-frontend"; then
            restart_docker "immo-frontend"
        else
            start_service "frontend"
        fi
    fi
    
    # Rapport final
    if [ "$backend_ok" = true ] && [ "$frontend_ok" = true ]; then
        log "INFO" "✅ Tous les services sont opérationnels"
        return 0
    else
        return 1
    fi
}

# ============================================================
# SCRIPT PRINCIPAL
# ============================================================

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Log de démarrage
log "INFO" "============================================================"
log "INFO" "🚀 DÉMARRAGE DU MONITEUR DE SURVEILLANCE"
log "INFO" "============================================================"
log "INFO" "Backend: port $BACKEND_PORT"
log "INFO" "Frontend: port $FRONTEND_PORT"
log "INFO" "Intervalle: ${CHECK_INTERVAL}s"
log "INFO" "Logs: $LOG_FILE"
log "INFO" "============================================================"

# Vérifier les commandes nécessaires
if ! command -v nc &> /dev/null && ! command -v curl &> /dev/null; then
    log "WARN" "ni 'nc' ni 'curl' installés - Utilisation de méthode fallback"
fi

# Boucle infinie de surveillance
while true; do
    check_all_services
    
    # Afficher un point pour montrer que le script tourne
    echo -n "."
    
    # Attendre l'intervalle
    sleep $CHECK_INTERVAL
    
    # Retour à la ligne toutes les 6 points (1 minute)
    ((i++))
    if [ $((i % 6)) -eq 0 ]; then
        echo ""
        i=0
    fi
done
