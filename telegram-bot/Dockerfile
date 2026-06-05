FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create data directory for SQLite volume
RUN mkdir -p data

ENV PORT=3001
EXPOSE 3001

CMD ["node", "bot.js"]
