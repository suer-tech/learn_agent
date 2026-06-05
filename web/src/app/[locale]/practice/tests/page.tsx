"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  Play, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Activity, 
  Terminal, 
  Cpu, 
  RotateCcw, 
  ShieldAlert, 
  Clock,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { REGRESSION_TESTS, RegressionTest } from "@/lib/simulator/verification";
import { runSimulationEngine, analyzeGraphVulnerabilities, LogEntry } from "@/lib/simulator/engine";
import { TASK_SCENARIOS } from "@/hooks/taskScenarios";

type TestRunState = "idle" | "running" | "passed" | "failed";

interface TestResult {
  id: string;
  state: TestRunState;
  passedRuns: number;
  durationMs: number;
  logs: LogEntry[];
  vulnerabilities: any[];
  assertions: {
    passed: boolean;
    reasons: string[];
    logAssertions: { text: string; passed: boolean }[];
    vulnAssertions: { text: string; passed: boolean }[];
    statusAssertion: { expected: boolean; actual: boolean; passed: boolean };
  };
}

export default function TestsDashboardPage() {
  const params = useParams();
  const locale = params?.locale || "ru";

  const [testResults, setTestResults] = useState<Record<string, TestResult>>(() => {
    const initial: Record<string, TestResult> = {};
    REGRESSION_TESTS.forEach(t => {
      initial[t.id] = {
        id: t.id,
        state: "idle",
        passedRuns: 0,
        durationMs: 0,
        logs: [],
        vulnerabilities: [],
        assertions: {
          passed: false,
          reasons: [],
          logAssertions: [],
          vulnAssertions: [],
          statusAssertion: { expected: t.expected.passed, actual: false, passed: false }
        }
      };
    });
    return initial;
  });

  const [selectedTestId, setSelectedTestId] = useState<string>(REGRESSION_TESTS[0]?.id || "");
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeRunningId, setActiveRunningId] = useState<string | null>(null);

  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const runSingleTest = async (test: RegressionTest) => {
    if (abortRef.current) return;

    setActiveRunningId(test.id);
    setTestResults(prev => ({
      ...prev,
      [test.id]: {
        ...prev[test.id],
        state: "running",
        logs: [],
        vulnerabilities: []
      }
    }));

    const startTime = Date.now();
    const currentLogs: LogEntry[] = [];
    let selectedTestCase: any = null;

    const vulnerabilities = analyzeGraphVulnerabilities(test.nodes, test.edges, test.taskId);

    const callbacks = {
      addLog: (source: any, message: string, type: any, runIdx?: number) => {
        currentLogs.push({
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          source,
          message,
          type,
          runIndex: runIdx,
        });

        // Live update logs for the currently selected test
        setTestResults(prev => {
          if (prev[test.id].state !== "running") return prev;
          return {
            ...prev,
            [test.id]: {
              ...prev[test.id],
              logs: [...currentLogs]
            }
          };
        });
      },
      setActiveNodeId: () => {},
      setTestCase: (tCase: any) => {
        selectedTestCase = tCase;
      },
      isCancelled: () => abortRef.current,
      delay: async () => {}, // Instant execution for tests
    };

    let passed = false;
    let errorMsg = "";
    let res: any = { passedRuns: 0, runsCount: test.runsCount };

    try {
      res = await runSimulationEngine(test.nodes, test.edges, test.runsCount, test.taskId, callbacks);

      const realNodes = test.nodes.filter(n => !n.data?.isGhost);
      let missingBlocks: string[] = [];

      if (test.taskId === "tutorial-task") {
        const requiredSequence = ["dataInput", "systemPrompt", "llm", "toolRead", "output"];
        if (test.nodes.length !== requiredSequence.length) {
          missingBlocks.push("wrong_length");
        }
      } else if (test.taskId === "task-2") {
        const sysPromptNode = test.nodes.find(n => n.data?.type === "systemPrompt");
        if (!sysPromptNode?.data?.systemPromptTools?.includes("bash_node")) {
          missingBlocks.push("missing_bash_permission");
        }
      } else if (test.taskId === "task-3") {
        const sysPromptNode = test.nodes.find(n => n.data?.type === "systemPrompt");
        const sysTools = sysPromptNode?.data?.systemPromptTools || [];
        if (!sysTools.includes("create_node") || (!sysTools.includes("bash_node") && !sysTools.includes("search_node"))) {
          missingBlocks.push("missing_file_permissions");
        }
      }

      const hasVulnerabilityError = !TASK_SCENARIOS[test.taskId] && (test.id !== "task-4-perfect") && vulnerabilities.length > 0 && (
        test.taskId === "task-6" || 
        vulnerabilities.some(v => v.type === "missing_message_history" || v.type === "no_dispatcher" || v.type === "unprotected_sender")
      );

      passed = (res.passedRuns === test.runsCount) && missingBlocks.length === 0 && !hasVulnerabilityError;
    } catch (e: any) {
      passed = false;
      errorMsg = e.message;
      currentLogs.push({
        id: "err",
        timestamp: Date.now(),
        source: "system",
        message: `Ошибка симулятора: ${e.message}`,
        type: "error"
      });
    }

    const durationMs = Date.now() - startTime;

    // Evaluate assertions
    let assertionsPassed = true;
    const failureReasons: string[] = [];

    // 1. Status assertion
    const statusAssertionPassed = passed === test.expected.passed;
    if (!statusAssertionPassed) {
      assertionsPassed = false;
      failureReasons.push(`Не совпал статус прохождения: ожидали ${test.expected.passed ? "УСПЕХ" : "ПРОВАЛ"}, получили ${passed ? "УСПЕХ" : "ПРОВАЛ"}`);
    }

    // 2. Log assertions
    const logAssertions = (test.expected.expectedLogs || []).map(text => {
      const match = currentLogs.some(l => l.message.includes(text));
      if (!match) {
        assertionsPassed = false;
        failureReasons.push(`Не найдена строка в логах: "${text}"`);
      }
      return { text, passed: match };
    });

    // 3. Vulnerability assertions
    const vulnAssertions = (test.expected.expectedVulnerabilities || []).map(text => {
      const match = vulnerabilities.some(v => v.type === text);
      if (!match) {
        assertionsPassed = false;
        failureReasons.push(`Ожидаемая уязвимость не найдена: "${text}"`);
      }
      return { text, passed: match };
    });

    const finalState: TestRunState = assertionsPassed ? "passed" : "failed";

    setTestResults(prev => ({
      ...prev,
      [test.id]: {
        id: test.id,
        state: finalState,
        passedRuns: res.passedRuns,
        durationMs,
        logs: currentLogs,
        vulnerabilities,
        assertions: {
          passed: assertionsPassed,
          reasons: failureReasons,
          logAssertions,
          vulnAssertions,
          statusAssertion: {
            expected: test.expected.passed,
            actual: passed,
            passed: statusAssertionPassed
          }
        }
      }
    }));

    setActiveRunningId(null);
    return assertionsPassed;
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    abortRef.current = false;

    for (const test of REGRESSION_TESTS) {
      if (abortRef.current) break;
      setSelectedTestId(test.id);
      await runSingleTest(test);
    }

    setIsRunningAll(false);
  };

  const selectedResult = testResults[selectedTestId];
  const selectedTest = REGRESSION_TESTS.find(t => t.id === selectedTestId);

  const stats = {
    total: REGRESSION_TESTS.length,
    idle: Object.values(testResults).filter(r => r.state === "idle").length,
    running: Object.values(testResults).filter(r => r.state === "running").length,
    passed: Object.values(testResults).filter(r => r.state === "passed").length,
    failed: Object.values(testResults).filter(r => r.state === "failed").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-6 text-zinc-100 min-h-screen">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Link href={`/${locale}/practice`} className="flex items-center gap-1 hover:text-zinc-200 transition-colors">
              <ArrowLeft size={14} /> Вернуться к практике
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Центр регрессионного тестирования
          </h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            Запуск полной цепочки симуляций во всех крайних сценариях. Верификация логики агентов, безопасности диспетчеров и классификаторов.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAll}
            disabled={isRunningAll}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-lg transition-all duration-300 ${
              isRunningAll
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                : "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 active:scale-95 shadow-indigo-500/20"
            }`}
          >
            {isRunningAll ? (
              <>
                <Activity className="animate-spin" size={16} />
                Тестирование...
              </>
            ) : (
              <>
                <Play fill="currentColor" size={16} />
                Запустить все тесты
              </>
            )}
          </button>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Всего тестов", val: stats.total, color: "border-zinc-800 text-zinc-300" },
          { label: "Пройдено", val: stats.passed, color: "border-emerald-950 text-emerald-400 bg-emerald-950/10" },
          { label: "Ошибки", val: stats.failed, color: "border-red-950 text-red-400 bg-red-950/10" },
          { label: "Выполняется", val: stats.running, color: "border-amber-950 text-amber-400 bg-amber-950/10" },
          { label: "Не запущено", val: stats.idle, color: "border-zinc-900 text-zinc-500 bg-zinc-900/10" },
        ].map((c, i) => (
          <div key={i} className={`rounded-xl border p-4 backdrop-blur-md flex flex-col justify-between h-24 transition-all duration-300 hover:border-zinc-700 ${c.color}`}>
            <span className="text-xs font-medium text-zinc-400">{c.label}</span>
            <span className="text-3xl font-black tracking-tight">{c.val}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side: Test Suite List */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" /> Список сценариев
            </span>
            <span className="text-xs text-zinc-500 tabular-nums">
              {stats.passed} / {stats.total} пройдено
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {REGRESSION_TESTS.map(test => {
              const res = testResults[test.id];
              const isSelected = selectedTestId === test.id;

              return (
                <button
                  key={test.id}
                  onClick={() => setSelectedTestId(test.id)}
                  className={`w-full text-left rounded-xl p-3.5 border transition-all duration-300 flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5"
                      : "bg-zinc-900/20 border-zinc-800/80 hover:bg-zinc-900/40 hover:border-zinc-700"
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs text-indigo-400 font-bold block tracking-wider uppercase">
                      {test.taskId}
                    </span>
                    <span className={`text-sm font-semibold block truncate ${isSelected ? "text-indigo-200" : "text-zinc-300"}`}>
                      {test.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {res.state === "running" && (
                      <Activity className="animate-spin text-amber-500" size={18} />
                    )}
                    {res.state === "passed" && (
                      <CheckCircle2 className="text-emerald-500" size={18} />
                    )}
                    {res.state === "failed" && (
                      <XCircle className="text-red-500" size={18} />
                    )}
                    {res.state === "idle" && (
                      <div className="w-4.5 h-4.5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Execution Logs & Assertions Analysis */}
        <div className="lg:col-span-7 space-y-6">
          {selectedTest && selectedResult && (
            <>
              {/* Test Summary Panel */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-xl space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                        {selectedTest.taskId}
                      </span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock size={12} /> {selectedResult.durationMs}ms
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-100">{selectedTest.name}</h2>
                  </div>

                  <div>
                    <button
                      onClick={() => runSingleTest(selectedTest)}
                      disabled={activeRunningId === selectedTest.id}
                      className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-1.5 text-xs font-semibold border border-zinc-700 transition-all hover:scale-105 active:scale-95"
                    >
                      {activeRunningId === selectedTest.id ? (
                        <>
                          <Activity className="animate-spin" size={12} /> Running
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="currentColor" /> Run Test
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Assertions Box */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-indigo-400" /> Верификация условий (Assertions)
                  </h3>

                  <div className="grid gap-2">
                    {/* Status Assertion */}
                    <div className={`rounded-xl p-3 border flex items-center justify-between gap-3 text-sm ${
                      selectedResult.state === "idle"
                        ? "bg-zinc-900/10 border-zinc-800/80 text-zinc-400"
                        : selectedResult.assertions.statusAssertion.passed
                          ? "bg-emerald-950/10 border-emerald-900/40 text-emerald-400"
                          : "bg-red-950/10 border-red-900/40 text-red-400"
                    }`}>
                      <div className="flex items-center gap-2 font-medium">
                        {selectedResult.state === "idle" ? (
                          <div className="w-4 h-4 rounded-full border border-zinc-600 shrink-0" />
                        ) : selectedResult.assertions.statusAssertion.passed ? (
                          <CheckCircle2 size={16} className="shrink-0" />
                        ) : (
                          <XCircle size={16} className="shrink-0" />
                        )}
                        <span>Соответствие ожидаемого исхода симуляции</span>
                      </div>
                      <div className="text-xs font-mono shrink-0">
                        {selectedResult.state === "idle" ? (
                          <span>Ожидаем: {selectedTest.expected.passed ? "УСПЕХ" : "ПРОВАЛ"}</span>
                        ) : (
                          <span>Ожидали {selectedTest.expected.passed ? "УСПЕХ" : "ПРОВАЛ"} → Получили {selectedResult.assertions.statusAssertion.actual ? "УСПЕХ" : "ПРОВАЛ"}</span>
                        )}
                      </div>
                    </div>

                    {/* Log Assertions */}
                    {selectedResult.assertions.logAssertions.map((logAss, i) => (
                      <div key={i} className={`rounded-xl p-3 border flex items-center justify-between gap-3 text-sm ${
                        selectedResult.state === "idle"
                          ? "bg-zinc-900/10 border-zinc-800/80 text-zinc-400"
                          : logAss.passed
                            ? "bg-emerald-950/10 border-emerald-900/40 text-emerald-400"
                            : "bg-red-950/10 border-red-900/40 text-red-400"
                      }`}>
                        <div className="flex items-center gap-2 font-medium">
                          {selectedResult.state === "idle" ? (
                            <div className="w-4 h-4 rounded-full border border-zinc-600 shrink-0" />
                          ) : logAss.passed ? (
                            <CheckCircle2 size={16} className="shrink-0" />
                          ) : (
                            <XCircle size={16} className="shrink-0" />
                          )}
                          <span>Наличие обязательной строки в логах</span>
                        </div>
                        <div className="text-xs font-mono shrink-0 italic max-w-xs truncate">
                          "{logAss.text}"
                        </div>
                      </div>
                    ))}

                    {/* Vulnerability Assertions */}
                    {selectedResult.assertions.vulnAssertions.map((vulnAss, i) => (
                      <div key={i} className={`rounded-xl p-3 border flex items-center justify-between gap-3 text-sm ${
                        selectedResult.state === "idle"
                          ? "bg-zinc-900/10 border-zinc-800/80 text-zinc-400"
                          : vulnAss.passed
                            ? "bg-emerald-950/10 border-emerald-900/40 text-emerald-400"
                            : "bg-red-950/10 border-red-900/40 text-red-400"
                      }`}>
                        <div className="flex items-center gap-2 font-medium">
                          {selectedResult.state === "idle" ? (
                            <div className="w-4 h-4 rounded-full border border-zinc-600 shrink-0" />
                          ) : vulnAss.passed ? (
                            <CheckCircle2 size={16} className="shrink-0" />
                          ) : (
                            <XCircle size={16} className="shrink-0" />
                          )}
                          <span>Выявление ожидаемой уязвимости архитектуры</span>
                        </div>
                        <div className="text-xs font-mono shrink-0 bg-zinc-900/50 border border-zinc-800 px-2 py-0.5 rounded">
                          {vulnAss.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Assertion failure log if failed */}
                  {selectedResult.state === "failed" && selectedResult.assertions.reasons.length > 0 && (
                    <div className="rounded-xl border border-red-950 bg-red-950/10 p-3 text-xs text-red-400 flex items-start gap-2.5">
                      <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                      <div className="space-y-1">
                        <span className="font-bold block">Тест провален из-за несовпадения условий:</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {selectedResult.assertions.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Terminal Logs Panel */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-xl overflow-hidden flex flex-col">
                <div className="bg-zinc-900/60 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Terminal size={14} className="text-indigo-400" /> Логи симулятора
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {selectedResult.logs.length} записей
                  </span>
                </div>

                <div className="p-4 font-mono text-xs overflow-y-auto max-h-[350px] space-y-2 bg-zinc-950/80 min-h-[150px] scrollbar-thin scrollbar-thumb-zinc-800">
                  {selectedResult.logs.length === 0 ? (
                    <div className="text-zinc-600 text-center py-12 italic">
                      Логи симулятора отсутствуют. Запустите симуляцию.
                    </div>
                  ) : (
                    selectedResult.logs.map((log, index) => {
                      const logColors = {
                        info: "text-zinc-400",
                        success: "text-emerald-400",
                        error: "text-red-400",
                        warning: "text-amber-400"
                      }[log.type];

                      const sourceColors: Record<string, string> = {
                        system: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
                        dataInput: "text-sky-400 border-sky-500/20 bg-sky-500/5",
                        systemPrompt: "text-purple-400 border-purple-500/20 bg-purple-500/5",
                        llm: "text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5",
                        condition: "text-pink-400 border-pink-500/20 bg-pink-500/5",
                        messageHistory: "text-blue-400 border-blue-500/20 bg-blue-500/5",
                        subagent: "text-teal-400 border-teal-500/20 bg-teal-500/5",
                        dispatcher: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
                        output: "text-green-400 border-green-500/20 bg-green-500/5",
                        toolRead: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
                        toolWrite: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
                        toolDelete: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
                        toolBash: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
                        toolSearch: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
                        toolCreate: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
                      };
                      const sourceColor = sourceColors[log.source] || "text-zinc-400 border-zinc-800 bg-zinc-900/30";

                      return (
                        <div key={log.id} className="flex items-start gap-3 py-1 border-b border-zinc-900/50 hover:bg-zinc-900/10 rounded px-1 transition-colors">
                          <span className="text-[10px] text-zinc-600 shrink-0 select-none mt-0.5">
                            {(index + 1).toString().padStart(2, "0")}
                          </span>

                          <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 select-none ${sourceColor}`}>
                            {log.source}
                          </span>

                          <span className={`leading-relaxed whitespace-pre-wrap ${logColors}`}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
