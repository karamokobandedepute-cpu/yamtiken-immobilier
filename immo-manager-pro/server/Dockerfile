FROM node:20-alpine

WORKDIR /app

# 1. On installe les outils de compilation de base (très important pour éviter l'exit code 1)
RUN apk add --no-cache python3 make g++

# 2. On copie les fichiers de configuration
COPY package*.json ./

# 3. On installe les dépendances
RUN npm install

# 4. On copie tout le reste du code
COPY . .

EXPOSE 5002

CMD ["npm", "start"]