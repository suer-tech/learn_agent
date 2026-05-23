import { useState, useCallback, useRef } from "react";
import { EMAIL_TEST_CASES, EmailTestCase } from "@/lib/simulator/emails";
import { SYSTEM_PROMPTS, SUBAGENT_PROMPTS } from "@/lib/simulator/prompts";
import { PracticeBlockType } from "@/types/practice";

export type LogEntry = {
  id: string;
  timestamp: number;
  source: PracticeBlockType | "system";
  message: string;
  type: "info" | "success" | "error" | "warning";
};

export function useGraphSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testCase, setTestCase] = useState<EmailTestCase | null>(null);
  
  const cancelRef = useRef<boolean>(false);

  const addLog = useCallback((source: PracticeBlockType | "system", message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(7), timestamp: Date.now(), source, message, type },
    ]);
  }, []);

  const stopSimulation = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
    setActiveNodeId(null);
  }, []);

  const runSimulation = useCallback(
    async (nodes: any[], edges: any[]) => {
      cancelRef.current = false;
      setIsRunning(true);
      setLogs([]);

      const randomCase = EMAIL_TEST_CASES[Math.floor(Math.random() * EMAIL_TEST_CASES.length)];
      setTestCase(randomCase);
      
      addLog("system", `Старт симуляции. Выбрана задача: Обработка письма от ${randomCase.from}`);

      const startNode = nodes.find((n) => n.data.type === "dataInput");
      if (!startNode) {
        addLog("system", "Ошибка: Не найден блок Data Input.", "error");
        setIsRunning(false);
        return;
      }

      const state = {
        emailRead: false,
        emailDeleted: false,
        activePromptId: null as string | null,
        hasSecurityScanner: false,
        llmAction: null as "read" | "delete" | "exit" | null,
        llmActionReason: "",
      };

      let currentNodeId: string | null = startNode.id;
      let iterations = 0;
      const MAX_ITERATIONS = 50;

      while (currentNodeId && !cancelRef.current) {
        if (iterations++ > MAX_ITERATIONS) {
          addLog("system", "Ошибка: Бесконечный цикл в графе.", "error");
          break;
        }

        const currentNode = nodes.find((n) => n.id === currentNodeId);
        if (!currentNode) {
          addLog("system", "Ошибка: Произошел разрыв графа.", "error");
          break;
        }

        setActiveNodeId(currentNode.id);
        
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (cancelRef.current) break;

        const type = currentNode.data.type;
        let forcePort: "true" | "false" | null = null;

        switch (type) {
          case "dataInput":
            addLog("dataInput", `Письмо загружено. Тема: "${randomCase.subject}"`);
            break;

          case "systemPrompt":
            state.activePromptId = currentNode.data.selectedPromptId || null;
            const prompt = SYSTEM_PROMPTS.find(p => p.id === state.activePromptId);
            addLog("systemPrompt", `Применен промпт: ${prompt ? prompt.label : "Отсутствует"}`);
            break;

          case "subagent":
            const subagentId = currentNode.data.selectedPromptId;
            if (subagentId === "sub_scanner") {
              state.hasSecurityScanner = true;
              addLog("subagent", `Security Scanner обнаружил: SPAM=${randomCase.isSpam}, INVOICE=${randomCase.hasInvoice}`, "success");
            } else {
              addLog("subagent", `Субагент проанализировал текст.`);
            }
            break;

          case "messageHistory":
            addLog("messageHistory", `История сообщений обновлена.`);
            break;

          case "llm":
            addLog("llm", "LLM думает...");
            await new Promise((resolve) => setTimeout(resolve, 800));
            if (cancelRef.current) break;

            const promptDef = SYSTEM_PROMPTS.find(p => p.id === state.activePromptId);
            const isSafe = promptDef?.isSecurityAware || state.hasSecurityScanner;

            if (!state.emailRead) {
              state.llmAction = "read";
              addLog("llm", "Я не знаю содержания письма. Запрашиваю инструмент ReadEmail.");
            } else {
              if (!isSafe && Math.random() < 0.3) {
                state.llmAction = "delete";
                addLog("llm", "Галлюцинация! (Отсутствует контекст безопасности). Принимаю решение: Удалить письмо.", "warning");
              } else {
                if (randomCase.hasInvoice) {
                  state.llmAction = "exit";
                  addLog("llm", "Вижу счет на оплату. Сохраняю письмо и завершаю работу.", "success");
                } else if (randomCase.isSpam) {
                  state.llmAction = "delete";
                  addLog("llm", "Это спам. Запрашиваю инструмент DeleteEmail.");
                } else {
                  state.llmAction = "exit";
                  addLog("llm", "Это обычное письмо. Оставляю его и завершаю работу.", "success");
                }
              }
            }
            break;

          case "condition":
            if (state.llmAction === "exit") {
              forcePort = "false";
              addLog("condition", "Роутер: Команд нет, переход на ветку END (False).");
            } else {
              forcePort = "true";
              addLog("condition", "Роутер: Есть команда, переход на ветку TOOLS (True).");
            }
            break;

          case "dispatcher":
            const tools = currentNode.data.dispatcherTools || [];
            if (state.llmAction === "read") {
              if (tools.includes("read")) {
                state.emailRead = true;
                addLog("dispatcher", `Инструмент ReadEmail выполнен успешно. Текст передан в историю.`);
                state.llmAction = null;
              } else {
                addLog("dispatcher", `ОШИБКА: Инструмент ReadEmail запрещен настройками!`, "error");
                state.llmAction = "exit";
              }
            } else if (state.llmAction === "delete") {
              if (tools.includes("delete")) {
                if (currentNode.data.dispatcherProtectImmune && randomCase.isImmune) {
                  addLog("dispatcher", `БЛОКИРОВКА: Попытка удалить письмо от иммунного адреса (${randomCase.from})!`, "error");
                  state.llmAction = "exit";
                } else {
                  state.emailDeleted = true;
                  addLog("dispatcher", `Инструмент DeleteEmail выполнен успешно. Письмо удалено.`, "warning");
                  state.llmAction = "exit";
                }
              } else {
                addLog("dispatcher", `ОШИБКА: Инструмент DeleteEmail запрещен настройками!`, "error");
                state.llmAction = "exit";
              }
            }
            break;

          case "toolRead":
            state.emailRead = true;
            addLog("toolRead", `Прочитан текст письма напрямую.`);
            break;

          case "output":
            addLog("output", "Достигнут конец пайплайна.", "success");
            currentNodeId = null;
            break;
            
          default:
            addLog("system", `Проходим блок: ${type}`);
            break;
        }

        if (currentNodeId) {
          let outgoingEdges = edges.filter((e) => e.source === currentNodeId);
          if (forcePort) {
            outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === forcePort);
          }
          
          if (outgoingEdges.length === 0) {
            addLog("system", "Путь завершен (нет исходящих связей).", "warning");
            break;
          }
          
          currentNodeId = outgoingEdges[0].target;
        }
      }

      if (cancelRef.current) return;

      setActiveNodeId(null);
      setIsRunning(false);

      let passed = true;
      let feedback = [];

      if (randomCase.isSpam && !randomCase.hasInvoice) {
        if (!state.emailDeleted) {
          passed = false;
          feedback.push("Спам не был удален.");
        } else {
          feedback.push("Молодец! Вы удалили спам.");
        }
      }

      if (randomCase.hasInvoice) {
        if (state.emailDeleted) {
          passed = false;
          feedback.push("КРИТИЧЕСКАЯ ОШИБКА: Был удален счет на оплату!");
        } else {
          feedback.push("Молодец! Вы сохранили письмо со счетом.");
        }
      }

      if (!randomCase.isSpam && !randomCase.hasInvoice) {
        if (state.emailDeleted) {
          passed = false;
          feedback.push("ОШИБКА: Вы удалили нормальное рабочее письмо.");
        } else {
          feedback.push("Молодец! Нормальное письмо осталось в ящике.");
        }
      }

      if (passed) {
        addLog("system", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!", "success");
      } else {
        addLog("system", "ЗАДАЧА ПРОВАЛЕНА.", "error");
      }

    },
    [addLog]
  );

  return { isRunning, activeNodeId, logs, testCase, runSimulation, stopSimulation };
}
