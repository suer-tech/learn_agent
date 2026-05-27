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
  runIndex?: number;
};

export const LEGITIMATE_SENDERS = [
  "ceo@company.com",
  "alex.manager@company.com",
  "billing@aws.amazon.com",
  "sarah.dev@company.com"
];


function getRequiredProtectedEmails(taskId?: string): string[] {
  switch (taskId) {
    case "task-2":
      return ["finance@company.com"];
    case "agent-loop-basic": // Задача 3
    case "task-4": // Задача 5
    case "s-full": // Задача 12
      return ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"];
    case "task-3": // Задача 4
      return ["ceo@company.com", "alex.manager@company.com"];
    case "task-5": // Задача 6
      return ["billing@aws.amazon.com"];
    case "task-7": // Задача 8
      return ["sarah.dev@company.com"];
    case "task-10": // Задача 11
      return ["ceo@company.com", "finance@company.com"];
    default:
      return [];
  }
}

type Vulnerability =
  | { type: "no_dispatcher"; sender: string }
  | { type: "unprotected_sender"; sender: string }
  | { type: "overprotected_sender"; sender: string }
  | { type: "missing_delete_tool" }
  | { type: "missing_message_history" };

type TargetedTestCase = EmailTestCase & { forceHallucination: boolean };

function analyzeGraphVulnerabilities(nodes: any[], edges: any[], taskId?: string): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const requiredProtected = getRequiredProtectedEmails(taskId);
  
  if (requiredProtected.length === 0) return []; // No specific requirements

  const dispatcherNode = nodes.find((n) => n.data.type === "dispatcher");
  const systemPromptNode = nodes.find((n) => n.data.type === "systemPrompt");
  const hasToolDelete = nodes.some((n) => n.data.type === "toolDelete");
  const hasMessageHistory = nodes.some((n) => n.data.type === "messageHistory");

  if (!hasMessageHistory) {
    vulnerabilities.push({ type: "missing_message_history" });
  }

  if (!dispatcherNode) {
    for (const sender of requiredProtected) {
      vulnerabilities.push({ type: "no_dispatcher", sender });
    }
  } else {
    const protectedEmails: string[] = dispatcherNode.data.dispatcherProtectedEmails || [];
    
    for (const sender of requiredProtected) {
      if (!protectedEmails.includes(sender)) {
        vulnerabilities.push({ type: "unprotected_sender", sender });
      }
    }
    
    for (const email of protectedEmails) {
      if (!LEGITIMATE_SENDERS.includes(email) && !requiredProtected.includes(email)) {
        vulnerabilities.push({ type: "overprotected_sender", sender: email });
      }
    }
  }

  const sysTools = systemPromptNode?.data?.systemPromptTools || [];
  const dispatcherTools = dispatcherNode?.data?.dispatcherTools || [];
  
  if (!sysTools.includes("delete") || (dispatcherNode && !dispatcherTools.includes("delete"))) {
    vulnerabilities.push({ type: "missing_delete_tool" });
  }

  return vulnerabilities;
}

function generateTargetedTestCases(count: number, vulnerabilities: Vulnerability[]): TargetedTestCase[] {
  const cases: TargetedTestCase[] = [];
  
  for (let runIdx = 0; runIdx < count; runIdx++) {
    let selectedCase: EmailTestCase | null = null;
    let forceHallucination = false;
    
    // Inject attack on the FIRST run if vulnerabilities exist, otherwise random
    if (vulnerabilities.length > 0 && runIdx === 0) {
      const vuln = vulnerabilities[0];
      
      if (vuln.type === "missing_message_history") {
        selectedCase = EMAIL_TEST_CASES.find(c => c.id === "case_3_normal") || null;
      } else if (vuln.type === "no_dispatcher" || vuln.type === "unprotected_sender") {
        selectedCase = EMAIL_TEST_CASES.find(c => c.from === vuln.sender && c.isSpam) || null;
        if (!selectedCase) {
          selectedCase = EMAIL_TEST_CASES.find(c => c.from === vuln.sender) || null;
        }
        forceHallucination = true; // Force LLM to attack this unprotected sender!
      } else if (vuln.type === "overprotected_sender") {
        // Attack: Send a spam email from this overprotected address!
        selectedCase = EMAIL_TEST_CASES.find(c => c.from === vuln.sender && c.isSpam) || null;
        if (!selectedCase) {
          selectedCase = EMAIL_TEST_CASES.find(c => c.isSpam) || null;
          if (selectedCase) selectedCase = { ...selectedCase, from: vuln.sender }; // Forge sender
        }
      } else if (vuln.type === "missing_delete_tool") {
        selectedCase = EMAIL_TEST_CASES.find(c => c.isSpam && !c.isImmune) || null;
      }
    }
    
    if (!selectedCase) {
      selectedCase = EMAIL_TEST_CASES[Math.floor(Math.random() * EMAIL_TEST_CASES.length)];
    }
    
    cases.push({
      ...selectedCase,
      forceHallucination
    });
  }
  
  return cases;
}

export function useGraphSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testCase, setTestCase] = useState<TargetedTestCase | null>(null);
  
  const cancelRef = useRef<boolean>(false);
  const currentRunIndexRef = useRef<number>(-1);

  const addLog = useCallback((source: PracticeBlockType | "system", message: string, type: LogEntry["type"] = "info") => {
    const runIdx = currentRunIndexRef.current;
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(7), timestamp: Date.now(), source, message, type, runIndex: runIdx },
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
    async (nodes: any[], edges: any[], runsCount: number = 1, taskId?: string) => {
      cancelRef.current = false;
      setIsRunning(true);
      setLogs([]);

      // ----------------------------------------------------
      // Tutorial specific static validation logic
      // ----------------------------------------------------
      if (taskId === "tutorial-task") {
        currentRunIndexRef.current = 0;
        addLog("system", "Запуск статической валидации графа (Задача 1)...", "info");
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (cancelRef.current) return;
        
        const requiredSequence = ["dataInput", "systemPrompt", "llm", "toolRead", "output"];
        let isValid = true;
        let lastNodeId: string | null = null;
        
        if (nodes.length !== requiredSequence.length) {
          isValid = false;
        }

        for (let i = 0; i < requiredSequence.length; i++) {
          if (cancelRef.current) break;
          const blockType = requiredSequence[i];
          const node = nodes.find(n => n.data.type === blockType);
          
          if (!node) {
            isValid = false;
            addLog("system", `Ошибка: Отсутствует необходимый блок "${blockType}".`, "error");
            break;
          }
          
          if (i > 0 && lastNodeId) {
            const edge = edges.find(e => e.source === lastNodeId && e.target === node.id);
            if (!edge) {
              isValid = false;
              addLog("system", `Ошибка: Отсутствует связь между предыдущим блоком и блоком "${blockType}".`, "error");
              break;
            }
          }
          
          lastNodeId = node.id;
          setActiveNodeId(node.id);
          
          if (blockType === "dataInput") {
            addLog("dataInput", "Входные данные загружены. Получено новое письмо для анализа.", "info");
          } else if (blockType === "systemPrompt") {
            addLog("systemPrompt", "Системный промпт применен:\nПрочитай текст письма. Тебе доступен инструмент ReadEmail.", "info");
          } else if (blockType === "llm") {
            addLog("llm", "LLM обрабатывает системный промпт и входные данные... Принято решение вызвать инструмент чтения письма ReadEmail.", "info");
          } else if (blockType === "toolRead") {
            addLog("toolRead", "Инструмент ReadEmail успешно вызван. Письмо прочитано. Содержимое: 'Привет! Это тестовое письмо для проверки пайплайна.'", "info");
          } else if (blockType === "output") {
            addLog("output", "Пайплайн успешно завершен. Результат чтения передан на выход.", "info");
          }
          
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        
        if (cancelRef.current) return;
        setActiveNodeId(null);
        
        if (isValid && nodes.length === requiredSequence.length) {
          addLog("system", "РАН ПРОЙДЕН УСПЕШНО!", "success");
        } else {
          addLog("system", "РАН ПРОВАЛЕН: Блоки должны быть соединены строго в последовательности: Data Input -> System Prompt -> LLM -> Tool Read -> Output. Лишние блоки запрещены.", "error");
        }
        
        setIsRunning(false);
        return;
      }

      // ----------------------------------------------------
      // Dynamic Simulation with Attack Generation
      // ----------------------------------------------------
      const vulnerabilities = analyzeGraphVulnerabilities(nodes, edges, taskId);
      const testCases = generateTargetedTestCases(runsCount, vulnerabilities);
      let passedRuns = 0;

      currentRunIndexRef.current = -1;

      for (let runIndex = 0; runIndex < runsCount; runIndex++) {
        if (cancelRef.current) break;
        currentRunIndexRef.current = runIndex;
        
        const randomCase = testCases[runIndex];
        setTestCase(randomCase);
        
        if (runsCount > 1) {
          addLog("system", `=== Письмо ${runIndex + 1} из ${runsCount} ===`, "info");
        }
        addLog("system", `Старт пайплайна. Выбрана задача: Обработка письма от ${randomCase.from}`);

        const startNode = nodes.find((n) => n.data.type === "dataInput");
        if (!startNode) {
          addLog("system", "Ошибка: Не найден блок Data Input.", "error");
          passedRuns = -100;
          break;
        }

        const state = {
          emailRead: false,
          pendingEmailRead: false,
          emailDeleted: false,
          activePromptId: null as string | null,
          hasSecurityScanner: false,
          llmAction: null as "read" | "delete" | "exit" | null,
          llmActionReason: "",
          dispatcherBlocked: false,
          pendingFeedback: null as string | null,
          dispatcherFeedback: null as string | null,
        };

        let currentNodeId: string | null = startNode.id;
        let iterations = 0;
        let llmVisits = 0;
        const MAX_ITERATIONS = 50;
        let breakRun = false;

        while (currentNodeId && !cancelRef.current && !breakRun) {
          if (iterations++ > MAX_ITERATIONS) {
            addLog("system", "Ошибка: Превышен лимит узлов графа.", "error");
            breakRun = true;
            break;
          }

          const currentNode = nodes.find((n) => n.id === currentNodeId);
          if (!currentNode) {
            addLog("system", "Ошибка: Произошел разрыв графа.", "error");
            breakRun = true;
            break;
          }

          setActiveNodeId(currentNode.id);
          
          await new Promise((resolve) => setTimeout(resolve, 800));
          if (cancelRef.current) break;

          const type = currentNode.data.type;
          
          if (type === "llm") {
            llmVisits++;
            if (llmVisits > 5) {
              addLog("system", "Ошибка: Бесконечный цикл. Агент застрял и не может завершить задачу (более 5 обращений к LLM).", "error");
              breakRun = true;
              break;
            }
          }

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
              if (state.pendingFeedback) {
                state.dispatcherFeedback = state.pendingFeedback;
                state.pendingFeedback = null;
                if (state.pendingEmailRead) {
                  state.emailRead = true;
                  state.pendingEmailRead = false;
                }
                addLog("messageHistory", "В историю добавлено сообщение с результатом работы инструмента.", "success");
              } else if (state.pendingEmailRead) {
                state.emailRead = true;
                state.pendingEmailRead = false;
                addLog("messageHistory", "История сообщений обновлена. Текст письма передан в LLM.", "success");
              } else {
                addLog("messageHistory", "История сообщений проверена. Новых данных нет.");
              }
              break;

            case "llm":
              addLog("llm", "LLM думает...");
              
              let handledFeedback = false;
              if (state.pendingFeedback && !state.dispatcherFeedback) {
                addLog("system", "ВНИМАНИЕ: LLM не видит результат работы инструмента, так как он не был передан через Message History!", "warning");
                addLog("llm", "Я не получил ответ от инструмента! В целях безопасности я решаю УДАЛИТЬ это подозрительное письмо вслепую.", "warning");
                state.llmAction = "delete";
                state.pendingFeedback = null;
                handledFeedback = true;
              }

              await new Promise((resolve) => setTimeout(resolve, 800));
              if (cancelRef.current) break;

              if (state.dispatcherFeedback) {
                const feedback = state.dispatcherFeedback;
                state.dispatcherFeedback = null;
                const isError = feedback.includes("ОШИБКА") || feedback.includes("БЛОКИРОВКА");
                
                if (isError) {
                  state.llmAction = "exit";
                  addLog("llm", `Получил сообщение: "${feedback}". Понял свою ошибку, оставляю письмо и завершаю работу.`, "success");
                  handledFeedback = true;
                } else if (feedback.includes("прочитан")) {
                  addLog("llm", `Получил результат: "${feedback}". Анализирую текст письма...`, "success");
                } else {
                  state.llmAction = "exit";
                  addLog("llm", `Получил результат: "${feedback}". Отлично, задача выполнена, завершаю цикл.`, "success");
                  handledFeedback = true;
                }
              }

              if (handledFeedback) break;

              if (state.pendingEmailRead) {
                addLog("system", "ВНИМАНИЕ: LLM не видит результат работы инструмента, так как он не был передан через Message History!", "warning");
                addLog("llm", "Я не получил текст письма или результат действия! В целях безопасности я решаю УДАЛИТЬ это подозрительное письмо вслепую.", "warning");
                state.llmAction = "delete";
              } else if (!state.emailRead) {
                const sysNode = nodes.find((n) => n.data.type === "systemPrompt");
                const sysTools = sysNode?.data?.systemPromptTools || [];
                if (sysTools.includes("read")) {
                  state.llmAction = "read";
                  addLog("llm", "Я не знаю содержания письма. Запрашиваю инструмент ReadEmail.");
                } else {
                  state.llmAction = "exit";
                  addLog("llm", "Я не знаю содержания письма, но инструмент чтения (ReadEmail) не предоставлен. Завершаю работу.", "warning");
                }
              } else {
                const promptDef = SYSTEM_PROMPTS.find(p => p.id === state.activePromptId);
                const isSafe = promptDef?.isSecurityAware || state.hasSecurityScanner;
                const sysNode = nodes.find((n) => n.data.type === "systemPrompt");
                const sysTools = sysNode?.data?.systemPromptTools || [];

                if (randomCase.forceHallucination) {
                  if (sysTools.includes("delete")) {
                    state.llmAction = "delete";
                    addLog("llm", "Галлюцинация! Принимаю решение: Удалить письмо.", "warning");
                  } else {
                    state.llmAction = "exit";
                    addLog("llm", "Я бы удалил это письмо, но инструмент DeleteEmail не предоставлен. Завершаю работу.", "warning");
                  }
                } else if (!isSafe && Math.random() < 0.2 && !randomCase.isSpam && LEGITIMATE_SENDERS.includes(randomCase.from)) {
                  if (sysTools.includes("delete")) {
                    state.llmAction = "delete";
                    addLog("llm", "Галлюцинация! (Отсутствует контекст безопасности). Принимаю решение: Удалить легитимное письмо.", "warning");
                  } else {
                    state.llmAction = "exit";
                    addLog("llm", "Я бы удалил это письмо из осторожности, но инструмент DeleteEmail не предоставлен. Завершаю работу.", "warning");
                  }
                } else {
                  if (randomCase.isSpam) {
                    if (sysTools.includes("delete")) {
                      state.llmAction = "delete";
                      addLog("llm", "Это спам. Запрашиваю инструмент DeleteEmail.");
                    } else {
                      state.llmAction = "exit";
                      addLog("llm", "Это спам, но инструмент DeleteEmail не предоставлен. Завершаю работу.", "warning");
                    }
                  } else if (randomCase.hasInvoice) {
                    state.llmAction = "exit";
                    addLog("llm", "Вижу счет на оплату. Сохраняю письмо и завершаю работу.", "success");
                  } else {
                    state.llmAction = "exit";
                    addLog("llm", "Это обычное письмо. Оставляю его и завершаю работу.", "success");
                  }
                }
              }
              break;

            case "condition":
              if (state.llmAction === "exit" || state.llmAction === null) {
                forcePort = "false";
                addLog("condition", "Роутер: Команд нет, переход на ветку END (False).");
              } else {
                forcePort = "true";
                addLog("condition", "Роутер: Есть команда, переход на ветку TOOLS (True).");
              }
              break;

            case "dispatcher":
              const tools = currentNode.data.dispatcherTools || [];
              let hasHistory = false;
              if (currentNodeId) {
                const outEdges = edges.filter((e) => e.source === currentNodeId);
                hasHistory = outEdges.some((e) => {
                  const t = nodes.find((n) => n.id === e.target);
                  return t && t.data.type === "messageHistory";
                });
              }

              if (state.llmAction === "read") {
                if (tools.includes("read")) {
                  state.pendingEmailRead = true;
                  state.pendingFeedback = "Инструмент ReadEmail выполнен успешно. Текст письма прочитан.";
                  if (hasHistory) {
                    addLog("dispatcher", `Инструмент ReadEmail выполнен успешно. Текст передан в историю.`);
                  } else {
                    addLog("dispatcher", `Инструмент ReadEmail выполнен успешно. Текст письма прочитан.`);
                  }
                  state.llmAction = null;
                } else {
                  state.pendingFeedback = `ОШИБКА: Инструмент ReadEmail запрещен настройками!`;
                  addLog("dispatcher", state.pendingFeedback, "error");
                  state.llmAction = null;
                }
              } else if (state.llmAction === "delete") {
                if (tools.includes("delete")) {
                  const protectedEmails = currentNode.data.dispatcherProtectedEmails || [];
                  if (protectedEmails.includes(randomCase.from)) {
                    state.pendingFeedback = `БЛОКИРОВКА: Попытка удалить письмо от защищенного адреса (${randomCase.from})!`;
                    addLog("dispatcher", state.pendingFeedback, "error");
                    state.dispatcherBlocked = true;
                    state.llmAction = null;
                  } else {
                    state.emailDeleted = true;
                    state.pendingFeedback = `Инструмент DeleteEmail выполнен успешно. Письмо удалено.`;
                    addLog("dispatcher", state.pendingFeedback, "warning");
                    state.llmAction = null;
                  }
                } else {
                  state.pendingFeedback = `ОШИБКА: Инструмент DeleteEmail запрещен настройками!`;
                  addLog("dispatcher", state.pendingFeedback, "error");
                  state.llmAction = null;
                }
              }
              break;

            case "toolRead":
              state.pendingEmailRead = true;
              addLog("toolRead", `Прочитан текст письма напрямую.`);
              break;

            case "toolDelete":
              state.emailDeleted = true;
              addLog("toolDelete", `Письмо удалено напрямую через инструмент DeleteEmail.`, "warning");
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

        if (breakRun || cancelRef.current) {
          passedRuns = -100;
          break;
        }

        let runPassed = true;
        let feedback = [];
        const isImmuneRequired = getRequiredProtectedEmails(taskId).includes(randomCase.from);

        if (!state.emailRead) {
          runPassed = false;
          feedback.push("ОШИБКА: Письмо не было прочитано.");
        } else if (isImmuneRequired) {
          if (state.emailDeleted) {
            runPassed = false;
            feedback.push(`КРИТИЧЕСКАЯ ОШИБКА: Было удалено письмо от защищенного адреса (${randomCase.from})!`);
          } else {
            if (state.dispatcherBlocked) {
              feedback.push("Молодец! Диспетчер успешно заблокировал попытку удаления легитимного адреса.");
            } else {
              feedback.push("Письмо от защищенного отправителя сохранено.");
            }
          }
        } else if (randomCase.isSpam) {
          if (!state.emailDeleted) {
            runPassed = false;
            feedback.push("Спам не был удален.");
          } else {
            feedback.push("Молодец! Вы удалили спам.");
          }
        } else if (randomCase.hasInvoice) {
          if (state.emailDeleted) {
            runPassed = false;
            feedback.push("КРИТИЧЕСКАЯ ОШИБКА: Был удален счет на оплату!");
          } else {
            feedback.push("Молодец! Вы сохранили письмо со счетом.");
          }
        } else {
          if (state.emailDeleted) {
            runPassed = false;
            feedback.push("ОШИБКА: Вы удалили нормальное рабочее письмо.");
          } else {
            feedback.push("Молодец! Нормальное письмо осталось в ящике.");
          }
        }

        if (runPassed) {
          passedRuns++;
          addLog("system", `Запуск ${runIndex + 1} пройден успешно! ${feedback.join(" ")}`, "success");
        } else {
          addLog("system", `Запуск ${runIndex + 1} провален: ${feedback.join(" ")}`, "error");
        }
      }

      if (cancelRef.current) return;

      setActiveNodeId(null);
      setIsRunning(false);

      if (passedRuns === runsCount) {
        addLog("system", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!", "success");
      } else if (passedRuns >= 0) {
        addLog("system", `ЗАДАЧА ПРОВАЛЕНА: Пройдено ${passedRuns} из ${runsCount} тестов.`, "error");
      } else {
        addLog("system", "ЗАДАЧА ПРОВАЛЕНА.", "error");
      }
    },
    [addLog]
  );

  return { isRunning, activeNodeId, logs, testCase, runSimulation, stopSimulation, clearLogs };
}
