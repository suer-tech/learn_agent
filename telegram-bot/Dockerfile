FROM node:20-slim

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем package files first for better caching
COPY package.json package-lock.json ./

# Устанавливаем зависимости под Linux
RUN npm install --omit=dev

# Копируем остальное
COPY . .

# Create data directory for SQLite volume
RUN mkdir -p data

ENV PORT=3001
EXPOSE 3001

CMD ["node", "bot.js"]
