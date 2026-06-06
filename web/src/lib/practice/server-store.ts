import "server-only";

import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import type {
  EvaluationResult,
  PracticeProgress,
  PracticeProgressFile,
  PracticeTask,
  PracticeTasksFile,
  PracticeUser,
  PracticeUsersFile,
  TrainerGraph,
} from "@/types/practice";

const DATA_DIR = path.join(process.cwd(), "src", "data", "practice");
const PROGRESS_PATH = path.join(DATA_DIR, "progress.json");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");
const SESSION_COOKIE = "practice_username";

// ── Auth toggle ──────────────────────────────────────────────────────
// Set to `true` to require Telegram group membership verification.
// When `false`, all visitors get guest access to the practice section.
const AUTH_ENABLED = false;
const GUEST_USERNAME = "guest";

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function nextMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await writeJson(filePath, fallback);
      return fallback;
    }
    throw error;
  }
}

async function writeJson<T>(filePath: string, data: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getTasks(): Promise<PracticeTask[]> {
  return (await readJson<PracticeTasksFile>(TASKS_PATH, { tasks: [] })).tasks;
}

export async function getTask(taskId: string) {
  return (await getTasks()).find((task) => task.id === taskId) ?? null;
}



async function readProgress() {
  return readJson<PracticeProgressFile>(PROGRESS_PATH, { progress: [] });
}

async function writeProgress(data: PracticeProgressFile) {
  await writeJson(PROGRESS_PATH, data);
}

export async function getCurrentUsername() {
  if (!AUTH_ENABLED) return GUEST_USERNAME;
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  return raw ? normalizeUsername(raw) : null;
}

export async function setPracticeSession(username: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, normalizeUsername(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(nextMonthStart()),
  });
}

export async function clearPracticeSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function checkAccess(usernameValue: string) {
  if (!AUTH_ENABLED) {
    const username = normalizeUsername(usernameValue) || GUEST_USERNAME;
    await setPracticeSession(username);
    return { ok: true, username, accessUntil: nextMonthStart() };
  }
  const username = normalizeUsername(usernameValue);
  const botUrl = process.env.BOT_API_URL;
  const botSecret = process.env.BOT_API_SECRET;

  if (!botUrl || !botSecret) {
    console.error("Missing BOT_API_URL or BOT_API_SECRET");
    return { ok: false, reason: "Внутренняя ошибка сервера (не настроен бот)." };
  }

  try {
    const response = await fetch(`${botUrl}/verify?username=${encodeURIComponent(username)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${botSecret}`,
      },
      cache: "no-store",
    });

    const payload = await response.json();

    if (!payload.ok) {
      return { ok: false, reason: payload.reason || "Доступ запрещен." };
    }

    await setPracticeSession(username);
    return { ok: true, username, accessUntil: nextMonthStart() };
  } catch (error) {
    console.error("Error communicating with bot API:", error);
    return { ok: false, reason: "Не удалось связаться с сервисом авторизации." };
  }
}

export async function getProgressForUser(usernameValue: string) {
  const username = normalizeUsername(usernameValue);
  return (await readProgress()).progress.filter((item) => item.username === username);
}

export async function upsertProgress(entry: PracticeProgress) {
  const data = await readProgress();
  const index = data.progress.findIndex(
    (item) => item.username === entry.username && item.taskId === entry.taskId
  );
  if (index === -1) {
    data.progress.push(entry);
  } else {
    data.progress[index] = entry;
  }
  await writeProgress(data);
}

function edgeKey(source: string, target: string) {
  return `${source}->${target}`;
}

export function evaluateGraph(task: PracticeTask, graph: TrainerGraph): EvaluationResult {
  const nodeTypes = new Set(graph.nodes.map((node) => node.type));
  const edgeTypes = new Set(
    graph.edges
      .map((edge) => {
        const source = graph.nodes.find((node) => node.id === edge.source)?.type;
        const target = graph.nodes.find((node) => node.id === edge.target)?.type;
        return source && target ? edgeKey(source, target) : null;
      })
      .filter(Boolean) as string[]
  );

  const feedback: string[] = [];
  for (const block of task.blocks) {
    if (!nodeTypes.has(block)) feedback.push(`Не хватает блока: ${block}`);
  }
  for (const [source, target] of task.requiredEdges) {
    if (!edgeTypes.has(edgeKey(source, target))) {
      feedback.push(`Не хватает связи: ${source} -> ${target}`);
    }
  }
  for (const [source, target] of task.forbiddenEdges) {
    if (edgeTypes.has(edgeKey(source, target))) {
      feedback.push(`Лишняя связь ломает сценарий: ${source} -> ${target}`);
    }
  }

  const passed = feedback.length === 0;
  return {
    passed,
    score: passed ? task.score : Math.max(0, task.score - feedback.length * 15),
    result: passed ? task.expectedOutput : "graph_validation_failed",
    feedback: passed
      ? ["Граф прошел структурную проверку, получен ожидаемый финальный ответ."]
      : feedback,
  };
}
