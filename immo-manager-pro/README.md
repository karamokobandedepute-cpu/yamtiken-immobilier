# YAMTIKEN Immobilier - Monorepo

Ce projet unifiÃ© contient le **Frontend (React/Vite)** et le **Backend (Node.js/Express)**.

## PrÃ©requis
- **Node.js** (v18 ou v20 recommandÃ©)
- **NPM**
- **Docker & Docker Compose** (pour le dÃ©ploiement prod)
- **PM2** (installÃ© globalement via `npm install -g pm2` si dÃ©marrage en arriÃ¨re-plan sans Docker)

## Installation (DÃ©veloppement)

1. Copiez le fichier `.env.example` en `.env` Ã  la racine du projet et remplissez vos identifiants (Supabase, etc.).
   *Note : Un seul fichier `.env` contrÃ´le dÃ©sormais le front et le back.*

2. Installez toutes les dÃ©pendances (racine, client, et serveur) en une commande :
   ```bash
   npm run install:all
   ```

3. Mettez Ã  jour le schÃ©ma de la base de donnÃ©es :
   ```bash
   npm run db:push
   ```

## Commandes Uniques (Racine)

- **`npm run dev`** : Lance le backend et le frontend en parallÃ¨le. Le frontend attendra automatiquement que le backend soit prÃªt (`/api/health`) avant de se lancer.
- **`npm run build`** : Compile le backend et le frontend.
- **`npm run start:bg`** : DÃ©marre tout en arriÃ¨re-plan avec PM2 (sans fenÃªtre de terminal visible).
- **`npm run stop`** : ArrÃªte les processus PM2 en arriÃ¨re-plan.
- **`npm run logs`** : Affiche les logs en temps rÃ©el de PM2.
- **`npm run status`** : Affiche le statut des processus PM2.

## DÃ©ploiement avec Docker (RecommandÃ©)

Nous utilisons une architecture multi-conteneurs (Nginx pour le front, Node pour le back).

### Sur Windows
Double-cliquez simplement sur **`deploy.bat`**. Il va copier le `.env`, construire les images Docker et tout lancer.

### Sur Linux/Mac
ExÃ©cutez le script bash :
```bash
chmod +x deploy.sh
./deploy.sh
```

## DÃ©marrage au Boot (Windows - Sans Docker)
Si vous ne voulez pas utiliser Docker et prÃ©fÃ©rez PM2 :
1. Double-cliquez sur **`install-auto-boot.bat`**.
2. Cela crÃ©era un script invisible qui exÃ©cutera `npm run start:bg` Ã  chaque dÃ©marrage de votre session Windows.

## DÃ©pannage des Erreurs FrÃ©quentes

- **"CORS bloquÃ©"** : VÃ©rifiez que le port ou l'URL par laquelle vous accÃ©dez au front correspond Ã  `CLIENT_URL` dans le `.env`, ou testez depuis `localhost`.
- **"Base de donnÃ©es inaccessible"** : Assurez-vous que l'URL `DATABASE_URL` (Supabase) dans `.env` est correcte et n'a pas de caractÃ¨res spÃ©ciaux non encodÃ©s.
- **"Port dÃ©jÃ  utilisÃ©"** : Faites `npm run stop` (si PM2 tournait) ou tapez `npx kill-port 5000 5173`.
- **"Le frontend n'arrive pas Ã  joindre l'API"** : En dev, Vite redirige `/api` vers le backend. En prod (Docker), Nginx le fait. VÃ©rifiez vos conteneurs avec `docker-compose ps`.
