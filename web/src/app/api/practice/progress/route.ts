import { NextResponse } from "next/server";
import {
  getCurrentUsername,
  getProgressForUser,
  normalizeUsername,
  upsertProgress,
} from "@/lib/practice/server-store";
import type { PracticeProgress } from "@/types/practice";

export async function GET() {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ ok: false, progress: [] }, { status: 401 });
  }

  return NextResponse.json({ ok: true, progress: await getProgressForUser(username) });
}

export async function POST(request: Request) {
  const sessionUsername = await getCurrentUsername();
  if (!sessionUsername) {
    return NextResponse.json({ ok: false, reason: "Нет доступа к практике." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<PracticeProgress>;
  if (!body.taskId || !body.status) {
    return NextResponse.json({ ok: false, reason: "Некорректный прогресс." }, { status: 400 });
  }

  const entry: PracticeProgress = {
    username: normalizeUsername(sessionUsername),
    taskId: body.taskId,
    status: body.status,
    score: body.score ?? 0,
    lastResult: body.lastResult ?? "",
    updatedAt: new Date().toISOString(),
  };
  await upsertProgress(entry);

  return NextResponse.json({ ok: true, progress: entry });
}
