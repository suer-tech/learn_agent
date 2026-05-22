import Link from "next/link";
import { PracticeAccessForm } from "@/components/practice/access-form";

export default function PracticeAccessPage() {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <PracticeAccessForm />
      <p className="mx-auto mt-4 max-w-md text-sm text-[var(--color-text-secondary)]">
        Доступ обновляется ботом по событиям Telegram-группы. Если вы только что вступили в
        группу, напишите любое сообщение в чат и попробуйте снова.
      </p>
      <div className="mt-6 text-center text-sm">
        <Link href="/ru" className="text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-white">
          Вернуться к теории
        </Link>
      </div>
    </div>
  );
}
