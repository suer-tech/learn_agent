import { NextResponse } from "next/server";
import { checkAccess, clearPracticeSession, getCurrentUsername } from "@/lib/practice/server-store";

export async function GET() {
  const username = await getCurrentUsername();
  return NextResponse.json({ authenticated: Boolean(username), username });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: string };
  if (!body.username) {
    return NextResponse.json({ ok: false, reason: "Введите Telegram nickname." }, { status: 400 });
  }

  const result = await checkAccess(body.username);
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}

export async function DELETE() {
  await clearPracticeSession();
  return NextResponse.json({ ok: true });
}
