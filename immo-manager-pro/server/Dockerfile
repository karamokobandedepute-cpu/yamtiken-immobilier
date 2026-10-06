FROM node:20-alpine

WORKDIR /app

# 1. Outils de compilation + lib compatibilité (Pour bcrypt, prisma native)
RUN apk add --no-cache python3 make g++ libc6-compat openssl curl

# 2. Variables ENV par défaut (Peuvent être surchargées via Coolify)
ENV NODE_ENV=production \
    PORT=5002

# 3. Copie package.json + package-lock.json (verrouillage versions)
COPY package*.json ./

# 4. INSTALL INCASSABLE : legacy-peer-deps + PAS omit=dev (prisma CLI est dans devDep, requis pour prisma generate)
RUN npm install --legacy-peer-deps --no-audit --no-fund

# 5. Copie du code source (y compris prisma/schema.prisma)
COPY . .

# 6. Prisma generate - Schéma explicite (emballé pour résilience)
RUN set -eux ; \
    ls prisma/ ; \
    npx prisma generate --schema ./prisma/schema.prisma 2>&1 | tail -15

# 7. Dossier uploads (évite crash multer si absent)
RUN mkdir -p ./uploads

# PORT - DOIT correspondre à EXPOSE + docker-compose backend port + traefik loadbalancer.port
EXPOSE 5002

CMD ["npm", "start"]
