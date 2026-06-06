const { Telegraf } = require('telegraf');
const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_SECRET = process.env.BOT_API_SECRET;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = process.env.PORT || 3001;

if (!BOT_TOKEN || !API_SECRET || !CHAT_ID) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

// 1. Setup SQLite Database
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'bot.sqlite'));
console.log("Database connected.");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    status TEXT,
    last_verified_at DATETIME
  )
`);

// Prepare statements for reuse
const upsertUser = db.prepare(`
  INSERT INTO users (telegram_id, username, status, last_verified_at) 
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(telegram_id) DO UPDATE SET 
    username = excluded.username,
    status = excluded.status,
    last_verified_at = excluded.last_verified_at
`);

const updateUserStatus = db.prepare(
  `UPDATE users SET status = ?, last_verified_at = datetime('now') WHERE telegram_id = ?`
);

const getUserByUsername = db.prepare(
  `SELECT status FROM users WHERE username = ?`
);

// Helper to normalize username
function normalizeUsername(value) {
  return value ? value.trim().replace(/^@+/, "").toLowerCase() : null;
}

// 2. Setup Telegraf Bot
const bot = new Telegraf(BOT_TOKEN);

// Listen to chat membership updates
bot.on('chat_member', (ctx) => {
  const chat = ctx.chat;
  if (chat.id.toString() !== CHAT_ID) return;

  const newStatus = ctx.chatMember.new_chat_member.status;
  const user = ctx.chatMember.new_chat_member.user;

  if (['member', 'administrator', 'creator', 'restricted'].includes(newStatus)) {
    // User joined or is active
    try {
      upsertUser.run(user.id, normalizeUsername(user.username), newStatus);
    } catch (err) {
      console.error("DB Error on chat_member join:", err);
    }

    // Only send greeting if they just joined (transitioned from left/kicked to member)
    const oldStatus = ctx.chatMember.old_chat_member.status;
    if (['left', 'kicked'].includes(oldStatus)) {
       ctx.telegram.sendMessage(user.id, 
         "Добро пожаловать в сообщество! Ответьте, пожалуйста, на два вопроса:\n1. Кто вы и чем занимаетесь?\n2. Чего хотите от сообщества?"
       ).catch(err => console.error("Could not send greeting to user:", err));
    }
  } else if (['left', 'kicked'].includes(newStatus)) {
    // User left the group
    try {
      updateUserStatus.run(newStatus, user.id);
    } catch (err) {
      console.error("DB Error on chat_member leave:", err);
    }
  }
});

bot.launch({
  allowedUpdates: ['chat_member', 'message'],
}).then(() => console.log("Telegraf bot started via Long Polling (with chat_member updates)"));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


// 3. Setup Express API for the website
const app = express();

app.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ ok: false, reason: "Unauthorized" });
  }

  let username = req.query.username;
  if (!username) {
    return res.status(400).json({ ok: false, reason: "Missing username parameter" });
  }

  username = normalizeUsername(username);

  // Check the database
  try {
    const row = getUserByUsername.get(username);

    if (!row) {
      return res.status(404).json({ ok: false, reason: "Пользователь не найден в реестре Telegram-группы." });
    }

    if (['member', 'administrator', 'creator', 'restricted'].includes(row.status)) {
      return res.json({ ok: true });
    } else {
      return res.status(403).json({ ok: false, reason: "Пользователь не числится активным участником группы." });
    }
  } catch (err) {
    console.error("DB Error in /verify:", err);
    return res.status(500).json({ ok: false, reason: "Database error" });
  }
});

app.listen(PORT, () => {
  console.log(`Express API listening on port ${PORT}`);
});
