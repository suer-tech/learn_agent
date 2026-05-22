import { NextResponse } from "next/server";
import {
  evaluateGraph,
  getCurrentUsername,
  getTask,
  normalizeUsername,
  upsertProgress,
} from "@/lib/practice/server-store";
import type { TrainerGraph } from "@/types/practice";

export async function POST(request: Request) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ ok: false, reason: "Нет доступа к практике." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    graph?: TrainerGraph;
  };
  if (!body.taskId || !body.graph) {
    return NextResponse.json({ ok: false, reason: "Некорректный граф." }, { status: 400 });
  }

  const task = await getTask(body.taskId);
  if (!task) {
    return NextResponse.json({ ok: false, reason: "Задача не найдена." }, { status: 404 });
  }

  const evaluation = evaluateGraph(task, body.graph);
  await upsertProgress({
    username: normalizeUsername(username),
    taskId: task.id,
    status: evaluation.passed ? "passed" : "failed",
    score: evaluation.score,
    lastResult: evaluation.result,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, evaluation });
}
