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
const USERS_PATH = path.join(DATA_DIR, "users.json");
const PROGRESS_PATH = path.join(DATA_DIR, "progress.json");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");
const SESSION_COOKIE = "practice_username";

const ACTIVE_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

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

async function readUsers() {
  return readJson<PracticeUsersFile>(USERS_PATH, { users: [] });
}

async function writeUsers(data: PracticeUsersFile) {
  await writeJson(USERS_PATH, data);
}

async function readProgress() {
  return readJson<PracticeProgressFile>(PROGRESS_PATH, { progress: [] });
}

async function writeProgress(data: PracticeProgressFile) {
  await writeJson(PROGRESS_PATH, data);
}

export async function getCurrentUsername() {
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

async function verifyWithTelegram(user: PracticeUser) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || !user.telegramUserId) {
    return user;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: user.telegramUserId }),
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: { status?: PracticeUser["status"]; user?: { username?: string } };
  };

  if (!payload.ok || !payload.result?.status) {
    return user;
  }

  const now = new Date();
  return {
    ...user,
    username: normalizeUsername(payload.result.user?.username ?? user.username),
    status: payload.result.status,
    source: "telegram_getChatMember",
    lastEventAt: now.toISOString(),
    verifiedMonth: currentMonth(now),
    accessUntil: nextMonthStart(now),
  };
}

export async function checkAccess(usernameValue: string) {
  const username = normalizeUsername(usernameValue);
  const data = await readUsers();
  const index = data.users.findIndex((user) => normalizeUsername(user.username) === username);
  if (index === -1) {
    return { ok: false, reason: "Пользователь не найден в реестре Telegram-группы." };
  }

  let user = data.users[index];
  if (user.verifiedMonth !== currentMonth()) {
    user = await verifyWithTelegram(user);
    data.users[index] = user;
    await writeUsers(data);
  }

  if (!ACTIVE_STATUSES.has(user.status)) {
    return { ok: false, reason: "Пользователь не числится активным участником группы." };
  }

  if (user.verifiedMonth !== currentMonth()) {
    return { ok: false, reason: "Доступ за текущий месяц еще не подтвержден ботом." };
  }

  await setPracticeSession(username);
  return { ok: true, username, accessUntil: user.accessUntil };
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

export async function upsertTelegramUser(input: {
  username?: string;
  telegramUserId?: number;
  status: PracticeUser["status"];
  source: string;
}) {
  if (!input.username && !input.telegramUserId) return null;

  const data = await readUsers();
  const normalized = input.username ? normalizeUsername(input.username) : "";
  const index = data.users.findIndex((user) =>
    input.telegramUserId
      ? user.telegramUserId === input.telegramUserId
      : normalizeUsername(user.username) === normalized
  );
  const now = new Date();
  const user: PracticeUser = {
    username: normalized || data.users[index]?.username || `user_${input.telegramUserId}`,
    telegramUserId: input.telegramUserId ?? data.users[index]?.telegramUserId,
    status: input.status,
    source: input.source,
    lastEventAt: now.toISOString(),
    verifiedMonth: currentMonth(now),
    accessUntil: nextMonthStart(now),
  };

  if (index === -1) {
    data.users.push(user);
  } else {
    data.users[index] = { ...data.users[index], ...user };
  }

  await writeUsers(data);
  return user;
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
      ? ["Граф прошел структурную проверку, симуляция вернула ожидаемый финальный ответ."]
      : feedback,
  };
}
