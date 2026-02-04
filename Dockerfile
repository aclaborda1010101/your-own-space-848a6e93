# Use Node.js 22 (Alpine para imagen ligera)
FROM node:22-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluye devDependencies para build)
RUN npm install

# Copiar todo el código
COPY . .

# Build del proyecto con Vite
RUN npm run build

# Exponer puerto (Railway usa variable PORT)
EXPOSE ${PORT:-4173}

# Comando de inicio usando sh para expandir variable PORT
CMD sh -c "npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}"
