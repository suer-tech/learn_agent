import { useState, useCallback, useRef } from "react";
import { PracticeBlockType } from "@/types/practice";
import { 
  runSimulationEngine, 
  LogEntry, 
  TargetedTestCase, 
  LEGITIMATE_SENDERS 
} from "@/lib/simulator/engine";

export type { LogEntry, TargetedTestCase };
export { LEGITIMATE_SENDERS };

export function useGraphSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testCase, setTestCase] = useState<TargetedTestCase | null>(null);

  const cancelRef = useRef<boolean>(false);
  const currentRunIndexRef = useRef<number>(-1);

  const addLog = useCallback((source: PracticeBlockType | "system", message: string, type: LogEntry["type"] = "info", runIndex?: number) => {
    setLogs((prev) => [
      ...prev,
      { 
        id: Math.random().toString(36).substring(7), 
        timestamp: Date.now(), 
        source, 
        message, 
        type, 
        runIndex: runIndex ?? currentRunIndexRef.current 
      },
    ]);
  }, []);

  const stopSimulation = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
    setActiveNodeId(null);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const runSimulation = useCallback(
    async (nodes: any[], edges: any[], runsCount: number = 1, taskId?: string): Promise<{ passedRuns: number; runsCount: number } | null> => {
      cancelRef.current = false;
      setIsRunning(true);
      setLogs([]);
      setTestCase(null);
      currentRunIndexRef.current = -1;

      try {
        const result = await runSimulationEngine(nodes, edges, runsCount, taskId, {
          addLog: (source, message, type, runIdx) => {
            if (runIdx !== undefined) {
              currentRunIndexRef.current = runIdx;
            }
            addLog(source, message, type, runIdx);
          },
          setActiveNodeId,
          setTestCase: (tc) => setTestCase(tc),
          isCancelled: () => cancelRef.current,
        });
        return result;
      } catch (err: any) {
        addLog("system", `Критическая ошибка симуляции: ${err.message}`, "error");
        return null;
      } finally {
        setIsRunning(false);
        setActiveNodeId(null);
      }
    },
    [addLog]
  );

  return {
    isRunning,
    activeNodeId,
    logs,
    testCase,
    runSimulation,
    stopSimulation,
    clearLogs,
  };
}
