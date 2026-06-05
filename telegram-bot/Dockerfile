FROM node:20-slim

WORKDIR /app

# Копируем всё
COPY . .

# Удаляем node_modules с хоста (если они случайно скопировались) и ставим заново под Linux
RUN rm -rf node_modules && npm install --omit=dev

# Create data directory for SQLite volume
RUN mkdir -p data

ENV PORT=3001
EXPOSE 3001

CMD ["node", "bot.js"]
