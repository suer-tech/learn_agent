import { NextResponse } from "next/server";
import { upsertTelegramUser } from "@/lib/practice/server-store";
import type { PracticeUserStatus } from "@/types/practice";

interface TelegramUser {
  id?: number;
  username?: string;
}

interface TelegramUpdate {
  message?: { from?: TelegramUser; new_chat_members?: TelegramUser[]; left_chat_member?: TelegramUser };
  chat_member?: {
    new_chat_member?: { status?: PracticeUserStatus; user?: TelegramUser };
  };
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
  const writes = [];

  const chatMember = update.chat_member?.new_chat_member;
  if (chatMember?.user) {
    writes.push(
      upsertTelegramUser({
        username: chatMember.user.username,
        telegramUserId: chatMember.user.id,
        status: chatMember.status ?? "member",
        source: "telegram_chat_member",
      })
    );
  }

  for (const user of update.message?.new_chat_members ?? []) {
    writes.push(
      upsertTelegramUser({
        username: user.username,
        telegramUserId: user.id,
        status: "member",
        source: "telegram_new_chat_member",
      })
    );
  }

  if (update.message?.left_chat_member) {
    writes.push(
      upsertTelegramUser({
        username: update.message.left_chat_member.username,
        telegramUserId: update.message.left_chat_member.id,
        status: "left",
        source: "telegram_left_chat_member",
      })
    );
  }

  if (update.message?.from?.username) {
    writes.push(
      upsertTelegramUser({
        username: update.message.from.username,
        telegramUserId: update.message.from.id,
        status: "member",
        source: "telegram_message",
      })
    );
  }

  await Promise.all(writes);
  return NextResponse.json({ ok: true, updated: writes.length });
}
