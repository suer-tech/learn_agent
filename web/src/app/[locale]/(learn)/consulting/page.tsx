"use client";

import { useTranslations } from "@/lib/i18n";
import { Card } from "@/components/ui/card";

export default function ConsultingPage() {
  const t = useTranslations("consulting");

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>
      
      <Card className="p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="space-y-6">
          <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
            {t("description")}
          </p>
          
          <div className="flex flex-wrap items-center gap-2 text-lg font-medium">
            <span>{t("contact")}</span>
            <a 
              href="https://t.me/Suer_stuff" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              @Suer_stuff
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
