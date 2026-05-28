import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Clock, Trophy } from "lucide-react";
import { getCurrentUsername, getProgressForUser, getTasks } from "@/lib/practice/server-store";
import { Card } from "@/components/ui/card";
import type { PracticeProgressStatus } from "@/types/practice";

const STATUS_LABELS: Record<PracticeProgressStatus | "not_started", string> = {
  not_started: "Не начата",
  in_progress: "В процессе",
  passed: "Пройдена",
  failed: "Есть ошибки",
};

function StatusIcon({ status }: { status: PracticeProgressStatus | "not_started" }) {
  if (status === "passed") return <CheckCircle2 size={16} className="text-emerald-500" />;
  if (status === "in_progress") return <Clock size={16} className="text-amber-500" />;
  return <Circle size={16} className="text-zinc-400" />;
}

export default async function PracticePage() {
  const username = await getCurrentUsername();
  if (!username) redirect("/ru/practice/access");

  const [tasks, progress] = await Promise.all([getTasks(), getProgressForUser(username)]);
  const progressByTask = new Map(progress.map((item) => [item.taskId, item]));
  const passed = progress.filter((item) => item.status === "passed").length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4">
      <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-[var(--color-text-secondary)]">@{username}</div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Практика</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Собирайте учебных агентов из блоков, запускайте их проверку и проходите задачи по
            архитектуре агентного цикла.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          <Trophy size={16} className="text-amber-500" />
          {passed} / {tasks.length} задач пройдено
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => {
          const item = progressByTask.get(task.id);
          const status = item?.status ?? "not_started";
          return (
            <Link key={task.id} href={`/ru/practice/tasks/${task.id}`} className="group">
              <Card className="h-full rounded-lg p-5 transition-colors group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <StatusIcon status={status} />
                    {STATUS_LABELS[status]}
                  </div>
                  <div className="text-sm tabular-nums text-[var(--color-text-secondary)]">
                    {item?.score ?? 0} / {task.score}
                  </div>
                </div>
                <h2 className="mt-4 text-base font-semibold group-hover:underline">{task.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-[var(--color-text-secondary)]">
                  {task.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
