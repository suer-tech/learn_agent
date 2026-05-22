"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Send } from "lucide-react";

export function PracticeAccessForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/practice/access/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const payload = (await response.json()) as { ok?: boolean; reason?: string };
    setLoading(false);

    if (!payload.ok) {
      setError(payload.reason ?? "Не удалось открыть доступ.");
      return;
    }

    router.push("/ru/practice");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-md flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <LockKeyhole size={18} />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Доступ к практике</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Введите Telegram nickname из учебной группы.
          </p>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Telegram nickname
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="@username"
          className="h-11 rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm outline-none transition-colors focus:border-zinc-500"
        />
      </label>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Send size={16} />
        {loading ? "Проверяем..." : "Открыть практику"}
      </button>
    </form>
  );
}
