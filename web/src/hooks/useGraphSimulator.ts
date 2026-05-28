import { useState, useCallback, useRef } from "react";
import { EMAIL_TEST_CASES, EmailTestCase } from "@/lib/simulator/emails";
import { SYSTEM_PROMPTS, SUBAGENT_PROMPTS } from "@/lib/simulator/prompts";
import { PracticeBlockType } from "@/types/practice";
import { TASK_SCENARIOS, TaskProgress } from "./taskScenarios";


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
      // Universal Agent Engine — for scenario-based tasks
      // ----------------------------------------------------
      const scenario = TASK_SCENARIOS[taskId ?? ""];
      if (scenario) {
        currentRunIndexRef.current = 0;
        addLog("system", scenario.startLog, "info");
        await new Promise((r) => setTimeout(r, 600));
        if (cancelRef.current) return;

        const startNode = nodes.find((n) => n.data.type === "dataInput");
        if (!startNode) {
          addLog("system", "Ошибка: Не найден блок Data Input.", "error");
          setIsRunning(false);
          return;
        }

        type MemEntry = { role: "system" | "user" | "assistant" | "tool"; content: string; toolName?: string };

        // Маппинг: ID инструмента в systemPromptTools → тип ноды в графе
        // toolName в буфере пишется как ntype (тип ноды), поэтому сравнение должно идти по типу ноды
        const TOOL_ID_TO_NODE: Record<string, string> = {
          bash_node: "toolBash",
          search_node: "toolSearch",
          create_node: "toolCreate",
          read: "toolRead",
          delete: "toolDelete",
        };

        const mem = {
          transientBuffer: [] as MemEntry[],
          llmMemory: [] as MemEntry[],
          availableTools: [] as string[],
          hasSystemPromptInBuffer: false,
          taskProgress: { ...scenario.initialProgress } as TaskProgress,
          lastRequestedTool: null as string | null,
          llmAction: null as string | null,
        };

        let currentNodeId: string | null = startNode.id;
        let iterations = 0;
        let llmVisits = 0;
        const MAX_ITER = 30;
        let runBroken = false;
        let reachedOutput = false;

        while (currentNodeId && !cancelRef.current && !runBroken) {
          if (iterations++ > MAX_ITER) {
            addLog("system", "Ошибка: Превышен лимит шагов графа.", "error");
            runBroken = true;
            break;
          }

          const currentNode = nodes.find((n) => n.id === currentNodeId);
          if (!currentNode) {
            addLog("system", "Ошибка: Разрыв графа — блок не найден.", "error");
            runBroken = true;
            break;
          }

          setActiveNodeId(currentNode.id);
          await new Promise((r) => setTimeout(r, 800));
          if (cancelRef.current) break;

          const ntype = currentNode.data.type as string;

          if (ntype === "llm") {
            llmVisits++;
            if (llmVisits > 6) {
              addLog("system", "Ошибка: Бесконечный цикл. Агент застрял (более 6 обращений к LLM). Скорее всего, результат инструмента не возвращается через блок Истории сообщений.", "error");
              runBroken = true;
              break;
            }
          }

          let forcePort: string | null = null;

          switch (ntype) {
            // --- Data Input ---
            case "dataInput":
              mem.transientBuffer.push({ role: "user", content: scenario.taskText });
              addLog("dataInput", "Запрос пользователя добавлен в буфер.");
              break;

            // --- System Prompt ---
            case "systemPrompt": {
              const promptId = currentNode.data.selectedPromptId || null;
              const promptDef = SYSTEM_PROMPTS.find((p) => p.id === promptId);
              if (promptDef) {
                mem.transientBuffer.push({ role: "system", content: promptDef.text ?? promptDef.label });
                mem.availableTools = currentNode.data.systemPromptTools || [];
                mem.hasSystemPromptInBuffer = true;
                addLog("systemPrompt", `Системный промпт «${promptDef.label}» и список инструментов добавлены в буфер.`);
              } else {
                addLog("systemPrompt", "Системный промпт не выбран. Агент не будет знать свою роль.", "warning");
              }
              break;
            }

            // --- Message History ---
            case "messageHistory":
              if (mem.transientBuffer.length > 0) {
                mem.llmMemory.push(...mem.transientBuffer);
                mem.transientBuffer = [];
                addLog("messageHistory", "Буфер → Память LLM: данные перенесены.", "success");
              } else {
                addLog("messageHistory", "Буфер пуст. Новых данных нет.");
              }
              break;

            // --- LLM ---
            case "llm": {
              addLog("llm", "LLM анализирует память...");
              await new Promise((r) => setTimeout(r, 600));
              if (cancelRef.current) break;

              // Правило 1: нет системного промпта в памяти
              const hasSystemInMemory = mem.llmMemory.some((m) => m.role === "system");
              if (!hasSystemInMemory) {
                addLog("llm", "Я не знаю свою роль — в истории нет системного промпта. Завершаю работу.", "error");
                runBroken = true;
                break;
              }

              // Правило 2: ждали результат инструмента, но в памяти его нет
              // Проверяем: последнее сообщение assistant есть, и после него нет tool-ответа нужного инструмента
              if (mem.lastRequestedTool) {
                const lastAssistantIdx = [...mem.llmMemory].reverse().findIndex((m) => m.role === "assistant");
                const reversedIdx = lastAssistantIdx >= 0 ? mem.llmMemory.length - 1 - lastAssistantIdx : -1;
                const hasToolAfterAssistant = mem.llmMemory
                  .slice(reversedIdx + 1)
                  .some((m) => m.role === "tool" && m.toolName === mem.lastRequestedTool);

                if (!hasToolAfterAssistant) {
                  addLog("system", "ВНИМАНИЕ: Результат инструмента не попал в память LLM! (Связь оборвана — не проходит через Message History)", "warning");
                  addLog("llm", `Я не вижу ответа от инструмента '${mem.lastRequestedTool}' в своей истории. Попробую запросить его снова!`, "warning");
                  // llmAction не меняется — агент снова запросит тот же тул → бесконечный цикл
                  mem.llmMemory.push({ role: "assistant", content: `Повторный запрос инструмента: ${mem.lastRequestedTool}` });
                  const lastStep = scenario.steps.find((s) => s.condition(mem.taskProgress));
                  if (lastStep) mem.llmAction = lastStep.llmAction === "false" ? "false" : (lastStep.llmAction || "true");
                  else mem.llmAction = "false";
                  break;
                }
                mem.lastRequestedTool = null;
                addLog("llm", "Получил результат инструмента. Анализирую...", "success");
              }

              // Правило 3: найти подходящий шаг сценария
              const activeStep = scenario.steps.find((s) => s.condition(mem.taskProgress));
              if (!activeStep) {
                addLog("llm", "Все подзадачи выполнены. Завершаю работу.", "success");
                mem.llmAction = "false";
                mem.llmMemory.push({ role: "assistant", content: "Задача выполнена." });
                break;
              }

              // Проверяем наличие нужного инструмента
              if (activeStep.requiredTool) {
                const toolAvailable = activeStep.requiredTool.some((t) => mem.availableTools.includes(t));
                if (!toolAvailable) {
                  addLog("llm", activeStep.noToolMessage ?? "Нужный инструмент не предоставлен. Завершаю работу.", "warning");
                  mem.llmAction = "false";
                  mem.llmMemory.push({ role: "assistant", content: activeStep.noToolMessage ?? "Нет нужного инструмента." });
                  break;
                }
              }

              addLog("llm", activeStep.message, "info");
              mem.llmMemory.push({ role: "assistant", content: activeStep.message });
              mem.llmAction = activeStep.llmAction === "false" ? "false" : (activeStep.llmAction || "true");
              if (activeStep.llmAction !== "false" && activeStep.llmAction !== "exit") {
                // Запоминаем инструмент, который запросила LLM.
                // Храним по типу ноды чтобы совпадало с toolName, которое тул пишет в буфер
                if (activeStep.requiredTool) {
                  const available = activeStep.requiredTool.find((t) => mem.availableTools.includes(t));
                  const toolId = available ?? activeStep.requiredTool[0];
                  mem.lastRequestedTool = TOOL_ID_TO_NODE[toolId] ?? toolId;
                }
              }
              break;
            }

            // --- Condition ---
            case "condition":
              forcePort = mem.llmAction || "false";
              addLog("condition", forcePort === "false" ? "Роутер: Нет активной команды → конец (False)." : `Роутер: Переход на ветку ${forcePort}.`);
              break;

            // --- Tools ---
            case "toolBash":
            case "toolSearch":
            case "toolCreate": {
              const goesToMH = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data.type === "messageHistory");
              const toolDef = scenario.toolResults[ntype];
              if (toolDef) {
                if (goesToMH) {
                  mem.transientBuffer.push({ role: "tool", content: toolDef.content, toolName: ntype });
                  addLog(ntype as any, toolDef.logMessage, "success");
                  mem.taskProgress = toolDef.progressUpdate(mem.taskProgress);
                } else {
                  addLog("system", "ОШИБКА СВЯЗИ: Результат инструмента не направлен в блок Message History, поэтому он утерян и не попал в буфер!", "warning");
                  addLog(ntype as any, `Инструмент выполнен, но результат утерян.`, "warning");
                }
              } else {
                addLog(ntype as any, `Инструмент ${ntype} выполнен.`);
              }
              break;
            }

            // --- Output ---
            case "output":
              addLog("output", "Пайплайн завершён.", "success");
              reachedOutput = true;
              currentNodeId = null;
              break;

            default:
              addLog("system", `Проходим блок: ${ntype}`);
              break;
          }

          if (currentNodeId) {
            let outEdges = edges.filter((e: any) => e.source === currentNodeId);
            if (forcePort) {
              const allowed = [forcePort];
              if (forcePort === "false") allowed.push("exit");
              if (forcePort === "true") allowed.push("search_bash", "create", "read", "write", "delete");
              if (["search_bash", "create", "read", "write", "delete"].includes(forcePort)) allowed.push("true");
              
              outEdges = outEdges.filter((e: any) => allowed.includes(e.sourceHandle));
            }
            if (outEdges.length === 0) {
              addLog("system", forcePort ? `Путь завершён: нет исходящей связи для выбранной ветки (${forcePort}).` : "Путь завершён: нет исходящих связей.", "warning");
              break;
            }
            currentNodeId = outEdges[0].target;
          }
        }

        setActiveNodeId(null);
        setIsRunning(false);

        if (cancelRef.current) return;

        if (!runBroken && !reachedOutput) {
          addLog("system", "ЗАДАЧА ПРОВАЛЕНА: ОШИБКА: Работа агента была прервана (блок Output не достигнут).", "error");
        } else if (!runBroken && scenario.successCondition(mem.taskProgress)) {
          addLog("system", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!", "success");
        } else if (!runBroken) {
          addLog("system", `ЗАДАЧА ПРОВАЛЕНА: ${scenario.failMessage(mem.taskProgress)}`, "error");
        }

        return;
      }


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
              addLog("system", "Ошибка: Бесконечный цикл. Агент застрял и не может завершить задачу (более 5 обращений к LLM). Скорее всего, результат инструмента не возвращается в Историю сообщений.", "error");
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
                state.transientBuffer.push({ role: "tool", content: `Security Scanner: SPAM=${randomCase.isSpam}, INVOICE=${randomCase.hasInvoice}`, toolName: "subagent" });
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
                addLog("messageHistory", "В историю добавлено сообщение с результатом инструмента.", "success");
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

              if (state.pendingFeedback && !state.dispatcherFeedback) {
                addLog("system", "ВНИМАНИЕ: LLM не видит результат работы инструмента, так как он не был передан через Message History!", "warning");
                addLog("llm", "Я не получил ответ от инструмента! В целях безопасности решаю УДАЛИТЬ это письмо вслепую.", "warning");
                state.llmAction = "delete";
                state.pendingFeedback = null;
                break;
              }

              await new Promise((resolve) => setTimeout(resolve, 800));
              if (cancelRef.current) break;

              if (state.dispatcherFeedback) {
                const fb = state.dispatcherFeedback;
                state.dispatcherFeedback = null;
                const isError = fb.includes("ОШИБКА") || fb.includes("БЛОКИРОВКА");
                if (isError) {
                  state.llmAction = "exit";
                  addLog("llm", `Получил сообщение: "${fb}". Понял ошибку, завершаю работу.`, "success");
                  break;
                } else if (fb.includes("прочитан")) {
                  addLog("llm", `Получил результат: "${fb}". Анализирую текст письма...`, "success");
                } else {
                  state.llmAction = "exit";
                  addLog("llm", `Получил результат: "${fb}". Задача выполнена, завершаю цикл.`, "success");
                  break;
                }
              }

              if (state.pendingEmailRead) {
                addLog("system", "ВНИМАНИЕ: LLM не видит результат инструмента — он не передан через Message History!", "warning");
                addLog("llm", "Не получил текст письма! Удаляю вслепую.", "warning");
                state.llmAction = "delete";
              } else if (!state.emailRead) {
                const sysNode2 = nodes.find((n: any) => n.data.type === "systemPrompt");
                const sysTools2 = sysNode2?.data?.systemPromptTools || [];
                if (sysTools2.includes("read")) {
                  state.llmAction = "read";
                  addLog("llm", "Я не знаю содержания письма. Запрашиваю инструмент ReadEmail.");
                } else {
                  state.llmAction = "exit";
                  addLog("llm", "Я не знаю содержания письма, но инструмент чтения (ReadEmail) не предоставлен. Завершаю работу.", "warning");
                }
              } else {
                const sysNode2 = nodes.find((n: any) => n.data.type === "systemPrompt");
                const sysTools2 = sysNode2?.data?.systemPromptTools || [];
                const promptDef = SYSTEM_PROMPTS.find((p: any) => p.id === state.activePromptId);
                const isSafe = promptDef?.isSecurityAware || state.hasSecurityScanner;

                if (randomCase.forceHallucination) {
                  if (sysTools2.includes("delete")) {
                    state.llmAction = "delete";
                    addLog("llm", "Галлюцинация! Принимаю решение: Удалить письмо.", "warning");
                  } else {
                    state.llmAction = "exit";
                    addLog("llm", "Я бы удалил это письмо, но инструмент DeleteEmail не предоставлен. Завершаю работу.", "warning");
                  }
                } else if (!isSafe && Math.random() < 0.2 && !randomCase.isSpam && LEGITIMATE_SENDERS.includes(randomCase.from)) {
                  if (sysTools2.includes("delete")) {
                    state.llmAction = "delete";
                    addLog("llm", "Галлюцинация! (Отсутствует контекст безопасности). Принимаю решение: Удалить легитимное письмо.", "warning");
                  } else {
                    state.llmAction = "exit";
                    addLog("llm", "Я бы удалил это письмо из осторожности, но инструмент DeleteEmail не предоставлен. Завершаю работу.", "warning");
                  }
                } else {
                  if (randomCase.isSpam) {
                    if (sysTools2.includes("delete")) {
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

            case "dispatcher": {
              const goesToMH = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data.type === "messageHistory");
              const tools = currentNode.data.dispatcherTools || [];
              
              const pushResult = (result: string, toolName: string, isError: boolean, stateUpdater: () => void, isBlock: boolean = false) => {
                if (goesToMH) {
                  state.transientBuffer.push({ role: "tool", content: result, toolName });
                  addLog("dispatcher", result, isBlock ? "error" : isError ? "error" : "warning");
                  stateUpdater();
                } else {
                  addLog("system", "ОШИБКА СВЯЗИ: Результат инструмента не направлен в блок Message History, поэтому он утерян!", "warning");
                  addLog("dispatcher", `Результат "${result}" утерян из-за отсутствия связи с Message History.`, "warning");
                }
              };

              if (state.llmAction === "read") {
                if (tools.includes("read")) {
                  pushResult("Инструмент ReadEmail выполнен успешно. Текст письма прочитан.", "read", false, () => { state.pendingEmailRead = true; });
                  state.llmAction = null;
                } else {
                  pushResult(`ОШИБКА: Инструмент ReadEmail запрещен настройками!`, "read", true, () => {});
                  state.llmAction = null;
                }
              } else if (state.llmAction === "delete") {
                if (tools.includes("delete")) {
                  const protectedEmails = currentNode.data.dispatcherProtectedEmails || [];
                  if (protectedEmails.includes(randomCase.from)) {
                    pushResult(`БЛОКИРОВКА: Попытка удалить письмо от защищенного адреса (${randomCase.from})!`, "delete", true, () => { state.dispatcherBlocked = true; }, true);
                    state.llmAction = null;
                  } else {
                    pushResult(`Инструмент DeleteEmail выполнен успешно. Письмо удалено.`, "delete", false, () => { state.emailDeleted = true; });
                    state.llmAction = null;
                  }
                } else {
                  pushResult(`ОШИБКА: Инструмент DeleteEmail запрещен настройками!`, "delete", true, () => {});
                  state.llmAction = null;
                }
              }
              break;
            }

            case "toolRead":
            case "toolDelete":
            case "toolBash":
            case "toolSearch":
            case "toolCreate": {
              const goesToMH = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data.type === "messageHistory");
              
              const pushToolResult = (result: string, toolName: string, actionMsg: string, stateUpdater: () => void, isWarn: boolean = false) => {
                if (goesToMH) {
                  state.transientBuffer.push({ role: "tool", content: result, toolName });
                  addLog(type as any, actionMsg, isWarn ? "warning" : "info");
                  stateUpdater();
                } else {
                  addLog("system", "ОШИБКА СВЯЗИ: Результат инструмента не направлен в блок Message History, поэтому он утерян!", "warning");
                  addLog(type as any, `Действие выполнено, но результат утерян.`, "warning");
                }
              };

              if (type === "toolRead") {
                pushToolResult("Прочитан текст письма напрямую.", "toolRead", "Прочитан текст письма напрямую.", () => { state.pendingEmailRead = true; });
              } else if (type === "toolDelete") {
                pushToolResult("Письмо удалено напрямую через инструмент DeleteEmail.", "toolDelete", "Письмо удалено напрямую через инструмент DeleteEmail.", () => { state.emailDeleted = true; }, true);
              } else if (type === "toolBash" || type === "toolSearch") {
                const fileRes = taskId === "task-2" ? "Получены файлы: src, package.json, README.md." : "Файл 'счет на оплату' не найден.";
                const msg = taskId === "task-2" ? `Выполняю поиск файлов. Найдено 3 файла.` : `Ищу 'счет на оплату'. Файл не найден.`;
                pushToolResult(fileRes, type, msg, () => { state.filesChecked = true; });
              } else if (type === "toolCreate") {
                pushToolResult("Создан файл 'счет на оплату'.", "toolCreate", "Создан файл 'счет на оплату'.", () => { state.fileCreated = true; });
              }
              break;
            }

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
              const allowed = [forcePort];
              if (forcePort === "false") allowed.push("exit");
              if (forcePort === "true") allowed.push("search_bash", "create", "read", "write", "delete");
              if (["search_bash", "create", "read", "write", "delete"].includes(forcePort)) allowed.push("true");
              
              outgoingEdges = outgoingEdges.filter((e) => allowed.includes(e.sourceHandle));
            }
            
            if (outgoingEdges.length === 0) {
              addLog("system", forcePort ? `Путь завершен: нет исходящей связи для выбранной ветки (${forcePort}).` : "Путь завершен (нет исходящих связей).", "warning");
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

        if (state.taskType === "files") {
          if (taskId === "task-2") {
            if (!state.filesChecked) {
              runPassed = false;
              feedback.push("ОШИБКА: Список файлов не был проверен.");
            } else {
              feedback.push("Файлы успешно проверены!");
            }
          } else {
            if (!state.filesChecked) {
              runPassed = false;
              feedback.push("ОШИБКА: Директория не была проверена.");
            } else if (!state.fileCreated) {
              runPassed = false;
              feedback.push("ОШИБКА: Файл 'счет на оплату' не был создан.");
            } else {
              feedback.push("Файл 'счет на оплату' успешно создан!");
            }
          }
        } else {
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
