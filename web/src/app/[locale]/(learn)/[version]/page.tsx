import Link from "next/link";
import { LEARNING_PATH, VERSION_META, LAYERS } from "@/lib/constants";
import { LayerBadge } from "@/components/ui/badge";
import versionsData from "@/data/generated/versions.json";
import { VersionDetailClient } from "./client";
import { getTranslations } from "@/lib/i18n-server";
import { localizeMeta, getVersionSummary, getVersionRuTitle } from "@/lib/version-i18n";

export function generateStaticParams() {
  return LEARNING_PATH.map((version) => ({ version }));
}

export default async function VersionPage({
  params,
}: {
  params: Promise<{ locale: string; version: string }>;
}) {
  const { locale, version } = await params;

  const versionData = versionsData.versions.find((v) => v.id === version);
  const baseMeta = VERSION_META[version];
  const diff = versionsData.diffs.find((d) => d.to === version) ?? null;

  const tUi = getTranslations(locale, "ui");

  if (!versionData || !baseMeta) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">{tUi("version_not_found")}</h1>
        <p className="mt-2 text-zinc-500">{version}</p>
      </div>
    );
  }

  const meta = localizeMeta(baseMeta, version, locale);
  const t = getTranslations(locale, "version");
  const tSession = getTranslations(locale, "sessions");
  const tLayer = getTranslations(locale, "layer_labels");
  const layer = LAYERS.find((l) => l.id === meta.layer);

  const pathIndex = LEARNING_PATH.indexOf(version as typeof LEARNING_PATH[number]);
  const prevVersion = pathIndex > 0 ? LEARNING_PATH[pathIndex - 1] : null;
  const nextVersion =
    pathIndex < LEARNING_PATH.length - 1
      ? LEARNING_PATH[pathIndex + 1]
      : null;

  if (version !== "s01" && version !== "s02" && version !== "s03" && version !== "s04") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center py-20 text-center px-4">
        <div className="rounded-2xl border border-zinc-200 bg-white/50 p-8 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50 max-w-md">
          <div className="mb-4 text-4xl">⏳</div>
          <h1 className="text-xl font-bold sm:text-2xl mb-2">Урок появится после загрузки видео!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">Пожалуйста ожидайте!</p>
          <Link
            href={`/${locale}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90"
          >
            {locale === "ru" ? "На главную" : "Back to home"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">
            <span className="font-mono text-zinc-400 dark:text-zinc-500">{version}</span>
            {getVersionRuTitle(version) && (
              <>
                <span className="mx-2 text-zinc-300 dark:text-zinc-600">—</span>
                <span>{getVersionRuTitle(version)}</span>
              </>
            )}
          </h1>
          {layer && (
            <LayerBadge layer={meta.layer}>{tLayer(layer.id)}</LayerBadge>
          )}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {tSession(version) || meta.title}
        </p>
        {getVersionSummary(version) && (
          <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            {getVersionSummary(version)}
          </p>
        )}
      </header>

      {/* Client-rendered interactive sections */}
      <VersionDetailClient
        version={version}
        diff={diff}
        source={versionData.source}
        filename={versionData.filename}
      />

      {/* Prev / Next navigation */}
      <nav className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-700">
        {prevVersion ? (
          <Link
            href={`/${locale}/${prevVersion}`}
            className="group flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
          >
            <span className="transition-transform group-hover:-translate-x-1">
              &larr;
            </span>
            <div>
              <div className="text-xs text-zinc-400">{t("prev")}</div>
              <div className="font-medium">
                {prevVersion} - {tSession(prevVersion) || (VERSION_META[prevVersion] && localizeMeta(VERSION_META[prevVersion], prevVersion, locale).title)}
              </div>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {nextVersion ? (
          <Link
            href={`/${locale}/${nextVersion}`}
            className="group flex items-center gap-2 text-right text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
          >
            <div>
              <div className="text-xs text-zinc-400">{t("next")}</div>
              <div className="font-medium">
                {tSession(nextVersion) || (VERSION_META[nextVersion] && localizeMeta(VERSION_META[nextVersion], nextVersion, locale).title)} - {nextVersion}
              </div>
            </div>
            <span className="transition-transform group-hover:translate-x-1">
              &rarr;
            </span>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </div>
  );
}
