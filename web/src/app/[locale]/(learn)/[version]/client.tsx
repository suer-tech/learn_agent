"use client";

import { ArchDiagram } from "@/components/architecture/arch-diagram";
import { WhatsNew } from "@/components/diff/whats-new";
import { DesignDecisions } from "@/components/architecture/design-decisions";
import { DocRenderer } from "@/components/docs/doc-renderer";
import { SourceViewer } from "@/components/code/source-viewer";
import { AgentLoopSimulator } from "@/components/simulator/agent-loop-simulator";
import { ExecutionFlow } from "@/components/architecture/execution-flow";
import { SessionVisualization } from "@/components/visualizations";
import { Tabs } from "@/components/ui/tabs";
import { useTranslations } from "@/lib/i18n";

interface VersionDetailClientProps {
  locale: string;
  version: string;
  diff: {
    from: string;
    to: string;
    newClasses: string[];
    newFunctions: string[];
    newTools: string[];
    locDelta: number;
  } | null;
  source: string;
  filename: string;
}

const YOUTUBE_VIDEOS: Record<string, { id: string; url: string }> = {
  s01: {
    id: "aUuV9ZVHNj0",
    url: "https://youtu.be/aUuV9ZVHNj0?si=I7kOnS8OwInLfCeC",
  },
  s02: {
    id: "j_KHRzzsrJ0",
    url: "https://youtu.be/j_KHRzzsrJ0?si=5iz46pGhu3Ad3FGU",
  },
  s03: {
    id: "JatJwREEAUI",
    url: "https://youtu.be/JatJwREEAUI",
  },
};

export function VersionDetailClient({
  locale,
  version,
  diff,
  source,
  filename,
}: VersionDetailClientProps) {
  const t = useTranslations("version");

  const tabs = [
    { id: "learn", label: t("tab_learn") },
    { id: "simulate", label: t("tab_simulate") },
    { id: "code", label: t("tab_code") },
    { id: "deep-dive", label: t("tab_deep_dive") },
  ];

  const videoData = YOUTUBE_VIDEOS[version];

  return (
    <div className="space-y-6">
      {/* YouTube Video Block */}
      {videoData && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800 shadow-md aspect-video">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoData.id}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}

      {/* Hero Visualization */}
      <SessionVisualization version={version} />

      {/* Tabbed content */}
      <Tabs tabs={tabs} defaultTab="learn">
        {(activeTab) => (
          <>
            {activeTab === "learn" && <DocRenderer version={version} />}
            {activeTab === "simulate" && (
              <AgentLoopSimulator version={version} />
            )}
            {activeTab === "code" && (
              <SourceViewer source={source} filename={filename} />
            )}
            {activeTab === "deep-dive" && (
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xl font-semibold">
                    {t("execution_flow")}
                  </h2>
                  <ExecutionFlow version={version} />
                </section>
                <section>
                  <h2 className="mb-4 text-xl font-semibold">
                    {t("architecture")}
                  </h2>
                  <ArchDiagram version={version} />
                </section>
                {diff && <WhatsNew diff={diff} />}
                <DesignDecisions version={version} />
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
