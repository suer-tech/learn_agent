"use client";

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const visualizations: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<{ title?: string }>>
> = {
  s01: lazy(() => import("./s01-agent-loop")),
  s02: lazy(() => import("./s02-tool-dispatch")),
  s03: lazy(() => import("./s03-todo-write")),
  s04: lazy(() => import("./s04-subagent")),
  s05: lazy(() => import("./s05-skill-loading")),
  s06: lazy(() => import("./s06-context-compact")),
  s07: lazy(() => import("./s07-task-system")),
  s08: lazy(() => import("./s08-background-tasks")),
  s09: lazy(() => import("./s09-agent-teams")),
  s10: lazy(() => import("./s10-team-protocols")),
  s11: lazy(() => import("./s11-autonomous-agents")),
  s12: lazy(() => import("./s12-worktree-task-isolation")),
};

const fallback = (
  <div className="min-h-[500px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
);

function FullscreenContent({
  Component,
  title,
}: {
  Component: React.LazyExoticComponent<React.ComponentType<{ title?: string }>>;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const compute = () => {
      // Measure natural (un-transformed) size by reading inner getBoundingClientRect
      // divided by current scale, so the math is stable across re-runs.
      const rect = inner.getBoundingClientRect();
      const currentScale = scale || 1;
      const naturalH = rect.height / currentScale;
      const naturalW = rect.width / currentScale;
      const availH = container.clientHeight;
      const availW = container.clientWidth;
      if (naturalH <= 0 || naturalW <= 0 || availH <= 0 || availW <= 0) return;
      const next = Math.min(availH / naturalH, availW / naturalW, 1);
      setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
      setReady(true);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    ro.observe(inner);
    // Recompute after async children (lazy-loaded SVG, fonts) settle
    const t = setTimeout(compute, 60);
    const t2 = setTimeout(compute, 300);
    return () => {
      ro.disconnect();
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [scale]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        ref={innerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: "100%",
          maxWidth: 1280,
          opacity: ready ? 1 : 0,
          transition: "opacity 120ms ease-out",
        }}
      >
        <Suspense fallback={fallback}>
          <Component title={title} />
        </Suspense>
      </div>
    </div>
  );
}

export function SessionVisualization({ version }: { version: string }) {
  const t = useTranslations("viz");
  const Component = visualizations[version];
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  if (!Component) return null;

  return (
    <>
      <div className="relative min-h-[500px]">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          title="Развернуть на весь экран"
          aria-label="Развернуть на весь экран"
          className="group absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white/80 px-2 py-1.5 text-xs font-medium text-zinc-500 shadow-sm backdrop-blur-sm transition hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <Maximize2 size={14} />
          <span className="hidden sm:inline">Развернуть</span>
        </button>
        <Suspense fallback={fallback}>
          <Component title={t(version)} />
        </Suspense>
      </div>

      <AnimatePresence>
        {fullscreen && (
          <motion.div
            key="viz-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6 lg:p-10"
            onClick={() => setFullscreen(false)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                title="Закрыть (Esc)"
                aria-label="Закрыть"
                className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-zinc-900 hover:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <X size={18} />
              </button>
              <div className="flex-1 px-6 pb-6 pt-12 sm:px-10 sm:pb-8 sm:pt-12">
                <FullscreenContent Component={Component} title={t(version)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
