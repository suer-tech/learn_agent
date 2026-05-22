import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PracticeTrainer } from "@/components/practice/trainer";
import { getCurrentUsername, getTask } from "@/lib/practice/server-store";

export default async function PracticeTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const username = await getCurrentUsername();
  if (!username) redirect("/ru/practice/access");

  const { taskId } = await params;
  const task = await getTask(taskId);
  if (!task) notFound();

  return (
    <div className="space-y-4 py-4">
      <Link
        href="/ru/practice"
        className="inline-flex min-h-[40px] items-center gap-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={16} />
        К списку задач
      </Link>
      <PracticeTrainer task={task} />
    </div>
  );
}
