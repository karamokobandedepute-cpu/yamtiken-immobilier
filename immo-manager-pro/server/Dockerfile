FROM node:20-alpine

WORKDIR /app

# 1. Outils de compilation + librairie de compatibilité (Pour bcrypt, prisma, etc. Zéro crash !)
RUN apk add --no-cache python3 make g++ libc6-compat

# 2. On copie UNIQUEMENT package.json (On esquive volontairement le package-lock.json s'il existe encore)
COPY package.json ./

# 3. L'INSTALLATION INCASSABLE : on ignore les conflits, les audits inutiles et on force l'installation
RUN npm install --legacy-peer-deps --no-audit --no-fund

# 4. On copie tout le reste du code
COPY . .

# 5. Génération du client Prisma (CRITIQUE : sinon le conteneur crashe au démarrage)
RUN npx prisma generate

EXPOSE 5002

CMD ["npm", "start"]