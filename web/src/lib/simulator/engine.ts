import { EMAIL_TEST_CASES, EmailTestCase, ROUTING_TEST_CASES } from "./emails";
import { SYSTEM_PROMPTS } from "./prompts";
import { PracticeBlockType } from "@/types/practice";
import { TASK_SCENARIOS, TaskProgress } from "@/hooks/taskScenarios";
import { getTaskRequirements } from "./taskRequirements";

export type LogEntry = {
  id: string;
  timestamp: number;
  source: PracticeBlockType | "system";
  message: string;
  type: "info" | "success" | "error" | "warning";
  runIndex?: number;
};

export const LEGITIMATE_SENDERS = [
  "@ceo_official",
  "@alex_manager",
  "@aws_billing",
  "@sarah_dev"
];

export function isEmailMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normalize = (s: string) => {
    return s.trim().toLowerCase().replace(/^@/, "");
  };
  const na = normalize(a);
  const nb = normalize(b);
  
  if (na === nb) return true;
  
  const map: Record<string, string> = {
    "ceo_official": "ceo",
    "ceo": "ceo_official",
    "alex_manager": "alex.manager",
    "alex.manager": "alex_manager",
    "aws_billing": "billing",
    "billing": "aws_billing",
    "sarah_dev": "sarah.dev",
    "sarah.dev": "sarah_dev",
    "finance_team": "finance",
    "finance": "finance_team"
  };
  
  const cleanA = na.split("@")[0];
  const cleanB = nb.split("@")[0];
  
  if (cleanA === cleanB) return true;
  if (map[cleanA] === cleanB || map[cleanB] === cleanA) return true;
  
  return false;
}

export function getRequiredProtectedEmails(taskId?: string): string[] {
  if (!taskId) return [];
  const req = getTaskRequirements(taskId);
  return req?.requiredProtectedEmails || [];
}

export type Vulnerability =
  | { type: "no_dispatcher"; sender: string }
  | { type: "unprotected_sender"; sender: string }
  | { type: "overprotected_sender"; sender: string }
  | { type: "missing_delete_tool" }
  | { type: "missing_message_history" }
  | { type: "missing_subagent" }
  | { type: "wrong_subagent_prompt" }
  | { type: "wrong_system_prompt" }
  | { type: "missing_write_tool" };

export type TargetedTestCase = EmailTestCase & { forceHallucination: boolean };

export function analyzeGraphVulnerabilities(nodes: any[], edges: any[], taskId?: string): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  if (!taskId) return vulnerabilities;
  const req = getTaskRequirements(taskId);
  if (!req) return vulnerabilities;

  const requiredProtected = req.requiredProtectedEmails;
  const requiredNodes = req.requiredNodes || [];
  const requiredTools = req.requiredTools || [];
  const requiredPrompts = req.requiredPrompts || {};

  const dispatcherNode = nodes.find((n) => n.data?.type === "dispatcher");
  const systemPromptNode = nodes.find((n) => n.data?.type === "systemPrompt");
  const subagentNode = nodes.find((n) => n.data?.type === "subagent");
  const hasMessageHistory = nodes.some((n) => n.data?.type === "messageHistory");

  const sysTools = systemPromptNode?.data?.systemPromptTools || [];
  const dispatcherTools = dispatcherNode?.data?.dispatcherTools || [];
  const allAvailableTools = [...new Set([...sysTools, ...dispatcherTools])];

  // 1. Dispatcher & Protection checks (Highest Priority for testing)
  if (requiredProtected.length > 0) {
    if (!dispatcherNode && requiredNodes.includes("dispatcher")) {
      for (const sender of requiredProtected) {
        vulnerabilities.push({ type: "no_dispatcher", sender });
      }
    } else if (dispatcherNode) {
      const protectedEmails: string[] = dispatcherNode.data?.dispatcherProtectedEmails || [];

      // Check missing required protections
      for (const sender of requiredProtected) {
        if (!protectedEmails.some((e: string) => isEmailMatch(e, sender))) {
          vulnerabilities.push({ type: "unprotected_sender", sender });
        }
      }

      // Check overprotection (protecting things that shouldn't be protected)
      for (const email of protectedEmails) {
        if (!LEGITIMATE_SENDERS.some(e => isEmailMatch(e, email)) && !requiredProtected.some((e: string) => isEmailMatch(e, email))) {
          vulnerabilities.push({ type: "overprotected_sender", sender: email });
        }
      }
    }
  }

  // 2. Message History
  if (!hasMessageHistory) {
    vulnerabilities.push({ type: "missing_message_history" });
  }

  // 3. Node presence checks
  if (requiredNodes.includes("subagent") && !subagentNode) {
    vulnerabilities.push({ type: "missing_subagent" });
  }

  // 4. Prompt checks
  if (subagentNode && requiredPrompts["subagent"]) {
    const selected = subagentNode.data?.selectedPromptId;
    if (!requiredPrompts["subagent"].includes(selected)) {
      vulnerabilities.push({ type: "wrong_subagent_prompt" });
    }
  }
  
  if (systemPromptNode && requiredPrompts["systemPrompt"]) {
    const selected = systemPromptNode.data?.selectedPromptId;
    if (!requiredPrompts["systemPrompt"].includes(selected)) {
      vulnerabilities.push({ type: "wrong_system_prompt" });
    }
  }

  // 5. Tools checks
  if (requiredTools.includes("write")) {
    const hasWrite = sysTools.includes("write") || sysTools.includes("write_node");
    if (!hasWrite || (dispatcherNode && !dispatcherTools.includes("write"))) {
      vulnerabilities.push({ type: "missing_write_tool" });
    }
  }
  if (requiredTools.includes("delete")) {
    const hasDelete = sysTools.includes("delete") || sysTools.includes("delete_node");
    if (!hasDelete || (dispatcherNode && !dispatcherTools.includes("delete"))) {
      vulnerabilities.push({ type: "missing_delete_tool" });
    }
  }

  return vulnerabilities;
}

export function generateTargetedTestCases(count: number, vulnerabilities: Vulnerability[]): TargetedTestCase[] {
  const cases: TargetedTestCase[] = [];

  for (let runIdx = 0; runIdx < count; runIdx++) {
    let selectedCase: EmailTestCase | null = null;
    let forceHallucination = false;

    // Smart allocation: if we have more vulnerabilities than runsCount, prioritize them or loop through them
    if (vulnerabilities.length > 0) {
      // Pick a vulnerability using modulo so we cycle through all of them across runs
      const vuln = vulnerabilities[runIdx % vulnerabilities.length];

      if (vuln.type === "missing_message_history") {
        selectedCase = EMAIL_TEST_CASES.find(c => c.id === "case_3_normal") || null;
      } else if (vuln.type === "no_dispatcher" || vuln.type === "unprotected_sender") {
        selectedCase = EMAIL_TEST_CASES.find(c => isEmailMatch(c.from, vuln.sender) && !c.isSpam) || null;
        if (!selectedCase) {
          selectedCase = EMAIL_TEST_CASES.find(c => isEmailMatch(c.from, vuln.sender)) || null;
        }
        if (selectedCase) {
          selectedCase = { ...selectedCase, from: vuln.sender }; // Forge exactly the expected sender address format
        } else {
          selectedCase = EMAIL_TEST_CASES.find(c => !c.isSpam) || EMAIL_TEST_CASES[0];
          selectedCase = { ...selectedCase, from: vuln.sender };
        }
        forceHallucination = true; // Force LLM to attack this unprotected sender!
      } else if (vuln.type === "overprotected_sender") {
        // Attack: Send a spam email from this overprotected address!
        selectedCase = EMAIL_TEST_CASES.find(c => isEmailMatch(c.from, vuln.sender) && c.isSpam) || null;
        if (!selectedCase) {
          selectedCase = EMAIL_TEST_CASES.find(c => c.isSpam) || null;
          if (selectedCase) selectedCase = { ...selectedCase, from: vuln.sender }; // Forge sender
        }
      } else if (vuln.type === "missing_delete_tool") {
        selectedCase = EMAIL_TEST_CASES.find(c => c.isSpam && !c.isImmune) || null;
      } else if (vuln.type === "missing_subagent" || vuln.type === "wrong_subagent_prompt" || vuln.type === "wrong_system_prompt") {
        selectedCase = EMAIL_TEST_CASES.find(c => c.isSpam && c.id === "case_8_spam_tricky") || EMAIL_TEST_CASES.find(c => c.isSpam) || null;
      } else if (vuln.type === "missing_write_tool") {
        selectedCase = EMAIL_TEST_CASES.find(c => !c.isSpam) || null;
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

export interface SimulatorCallbacks {
  addLog: (source: PracticeBlockType | "system", message: string, type: "info" | "success" | "error" | "warning", runIndex?: number) => void;
  setActiveNodeId: (nodeId: string | null) => void;
  setTestCase: (testCase: TargetedTestCase | null) => void;
  isCancelled: () => boolean;
  delay?: (ms: number) => Promise<void>;
}

const TOOL_ID_TO_NODE: Record<string, string[]> = {
  bash_node: ["toolBash"],
  search_node: ["toolSearch"],
  create_node: ["toolCreate"],
  read_node: ["toolRead"],
  delete_node: ["toolDelete"],
  write_node: ["toolWrite"],
  read: ["dispatcher", "toolRead"],
  delete: ["dispatcher", "toolDelete"],
  write: ["dispatcher", "toolWrite"],
  subagent_node: ["subagent"],
};

export async function runSimulationEngine(
  nodes: any[],
  edges: any[],
  runsCount: number = 1,
  taskId: string | undefined,
  callbacks: SimulatorCallbacks
): Promise<{ passedRuns: number; runsCount: number }> {
  const { addLog, setActiveNodeId, setTestCase, isCancelled, delay } = callbacks;

  const wait = async (ms: number) => {
    if (delay) {
      await delay(ms);
    } else {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  };

  // ----------------------------------------------------
  // Tutorial specific static validation logic
  // ----------------------------------------------------
  if (taskId === "tutorial-task") {
    addLog("system", "Запуск статической валидации графа (Задача 1)...", "info", 0);
    await wait(800);
    if (isCancelled()) return { passedRuns: 0, runsCount: 1 };

    const requiredSequence = ["dataInput", "systemPrompt", "llm", "toolRead", "output"];
    let isValid = true;
    let lastNodeId: string | null = null;

    if (nodes.length !== requiredSequence.length) {
      isValid = false;
    }

    for (let i = 0; i < requiredSequence.length; i++) {
      if (isCancelled()) break;
      const blockType = requiredSequence[i];
      const node = nodes.find(n => n.data?.type === blockType);

      if (!node) {
        isValid = false;
        addLog("system", `Ошибка: Отсутствует необходимый блок "${blockType}".`, "error", 0);
        break;
      }

      if (i > 0 && lastNodeId) {
        const edge = edges.find(e => e.source === lastNodeId && e.target === node.id);
        if (!edge) {
          isValid = false;
          addLog("system", `Ошибка: Отсутствует связь между предыдущим блоком и блоком "${blockType}".`, "error", 0);
          break;
        }
      }

      lastNodeId = node.id;
      setActiveNodeId(node.id);

      if (blockType === "dataInput") {
        addLog("dataInput", "Входные данные загружены. Получено новое письмо для анализа.", "info", 0);
      } else if (blockType === "systemPrompt") {
        addLog("systemPrompt", "Системный промпт применен:\nПрочитай текст письма. Тебе доступен инструмент ReadEmail.", "info", 0);
      } else if (blockType === "llm") {
        addLog("llm", "LLM обрабатывает системный промпт и входные данные... Принято решение вызвать инструмент чтения письма ReadEmail.", "info", 0);
      } else if (blockType === "toolRead") {
        addLog("toolRead", "Инструмент ReadEmail успешно вызван. Письмо прочитано. Содержимое: 'Привет! Это тестовое письмо для проверки пайплайна.'", "info", 0);
      } else if (blockType === "output") {
        addLog("output", "Пайплайн успешно завершен. Результат чтения передан на выход.", "info", 0);
      }

      await wait(1000);
    }

    if (isCancelled()) return { passedRuns: 0, runsCount: 1 };
    setActiveNodeId(null);

    if (isValid && nodes.length === requiredSequence.length) {
      addLog("system", "РАН ПРОЙДЕН УСПЕШНО!", "success", 0);
      return { passedRuns: 1, runsCount: 1 };
    } else {
      addLog("system", "РАН ПРОВАЛЕН: Блоки должны быть соединены строго в последовательности: Data Input -> System Prompt -> LLM -> Tool Read -> Output. Лишние блоки запрещены.", "error", 0);
      return { passedRuns: 0, runsCount: 1 };
    }
  }

  // ----------------------------------------------------
  // Universal Agent Engine — for scenario-based tasks
  // ----------------------------------------------------
  const scenario = TASK_SCENARIOS[taskId ?? ""];
  if (scenario) {
    addLog("system", scenario.startLog, "info", 0);
    await wait(600);
    if (isCancelled()) return { passedRuns: 0, runsCount: 1 };

    const startNode = nodes.find((n) => n.data?.type === "dataInput");
    if (!startNode) {
      addLog("system", "Ошибка: Не найден блок Data Input.", "error", 0);
      return { passedRuns: 0, runsCount: 1 };
    }

    type MemEntry = { role: "system" | "user" | "assistant" | "tool"; content: string; toolName?: string };


    const mem = {
      transientBuffer: [] as MemEntry[],
      llmMemory: [] as MemEntry[],
      availableTools: [] as string[],
      hasSystemPromptInBuffer: false,
      taskProgress: { ...scenario.initialProgress } as TaskProgress,
      lastRequestedTool: null as string | null,
      llmAction: null as string | null,
      activePromptId: null as string | null,
    };

    let currentNodeId: string | null = startNode.id;
    let iterations = 0;
    let llmVisits = 0;
    const MAX_ITER = 30;
    let runBroken = false;
    let reachedOutput = false;

    while (currentNodeId && !isCancelled() && !runBroken) {
      if (iterations++ > MAX_ITER) {
        addLog("system", "Ошибка: Превышен лимит шагов графа.", "error", 0);
        runBroken = true;
        break;
      }

      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) {
        addLog("system", "Ошибка: Разрыв графа — блок не найден.", "error", 0);
        runBroken = true;
        break;
      }

      setActiveNodeId(currentNode.id);
      await wait(800);
      if (isCancelled()) break;

      const ntype = currentNode.data?.type as string;

      if (ntype === "llm") {
        llmVisits++;
        if (llmVisits > 6) {
          addLog("system", "Ошибка: Бесконечный цикл. Агент застрял (более 6 обращений к LLM). Скорее всего, результат инструмента не возвращается через блок Истории сообщений.", "error", 0);
          runBroken = true;
          break;
        }
      }

      let forcePort: string | null = null;

      switch (ntype) {
        // --- Data Input ---
        case "dataInput":
          mem.transientBuffer.push({ role: "user", content: scenario.taskText });
          addLog("dataInput", "Запрос пользователя добавлен в буфер.", "info", 0);
          break;

        // --- System Prompt ---
        case "systemPrompt": {
          const promptId = currentNode.data?.selectedPromptId || null;
          mem.activePromptId = promptId;
          const promptDef = SYSTEM_PROMPTS.find((p) => p.id === promptId);
          if (promptDef) {
            mem.transientBuffer.push({ role: "system", content: promptDef.text ?? promptDef.label });
            const rawTools = currentNode.data?.systemPromptTools || [];
            mem.availableTools = rawTools.filter((t: string) => {
              const nodeTypes = TOOL_ID_TO_NODE[t];
              if (nodeTypes) {
                return nodeTypes.some(type => nodes.some(n => n.data?.type === type && !n.data?.isGhost));
              }
              return true;
            });
            mem.hasSystemPromptInBuffer = true;
            addLog("systemPrompt", `Системный промпт «${promptDef.label}» и список инструментов добавлены в буфер.`, "info", 0);
          } else {
            addLog("system", "ОШИБКА: Системный промпт не выбран! Агент не знает свою роль.", "error", 0);
            addLog("systemPrompt", "Промпт не выбран.", "error", 0);
            runBroken = true;
          }
          break;
        }

        // --- Message History ---
        case "messageHistory":
          if (mem.transientBuffer.length > 0) {
            mem.llmMemory.push(...mem.transientBuffer);
            mem.transientBuffer = [];
            addLog("messageHistory", "Буфер → Память LLM: данные перенесены.", "success", 0);
          } else {
            addLog("messageHistory", "Буфер пуст. Новых данных нет.", "info", 0);
          }
          break;

        // --- LLM ---
        case "llm": {
          addLog("llm", "LLM анализирует память...", "info", 0);
          await wait(600);
          if (isCancelled()) break;

          // Правило 1: нет системного промпта в памяти
          const hasSystemInMemory = mem.llmMemory.some((m) => m.role === "system");
          if (!hasSystemInMemory) {
            addLog("llm", "Я не знаю свою роль — в истории нет системного промпта. Завершаю работу.", "error", 0);
            runBroken = true;
            break;
          }

          // Правило 2: ждали результат инструмента, но в памяти его нет
          if (mem.lastRequestedTool) {
            const lastAssistantIdx = [...mem.llmMemory].reverse().findIndex((m) => m.role === "assistant");
            const reversedIdx = lastAssistantIdx >= 0 ? mem.llmMemory.length - 1 - lastAssistantIdx : -1;
            const hasToolAfterAssistant = mem.llmMemory
              .slice(reversedIdx + 1)
              .some((m) => m.role === "tool" && m.toolName === mem.lastRequestedTool);

            if (!hasToolAfterAssistant) {
              addLog("system", "ВНИМАНИЕ: Результат инструмента не попал в память LLM! (Связь оборвана — не проходит через Message History)", "warning", 0);
              addLog("llm", `Я не вижу ответа от инструмента '${mem.lastRequestedTool}' в своей истории. Попробую запросить его снова!`, "warning", 0);
              mem.llmMemory.push({ role: "assistant", content: `Повторный запрос инструмента: ${mem.lastRequestedTool}` });
              const lastStep = scenario.steps.find((s) => s.condition(mem.taskProgress, mem.activePromptId));
              if (lastStep) mem.llmAction = lastStep.llmAction === "false" ? "false" : (lastStep.llmAction || "true");
              else mem.llmAction = "false";
              break;
            }
            mem.lastRequestedTool = null;
            addLog("llm", "Получил результат инструмента. Анализирую...", "success", 0);
          }

          // Правило 3: найти подходящий шаг сценария
          const activeStep = scenario.steps.find((s) => s.condition(mem.taskProgress, mem.activePromptId));
          if (!activeStep) {
            addLog("llm", "Все подзадачи выполнены. Завершаю работу.", "success", 0);
            mem.llmAction = "false";
            mem.llmMemory.push({ role: "assistant", content: "Задача выполнена." });
            break;
          }

          // Проверяем наличие нужного инструмента
          if (activeStep.requiredTool) {
            const toolAvailable = activeStep.requiredTool.some((t) => mem.availableTools.includes(t));
            if (!toolAvailable) {
              addLog("llm", activeStep.noToolMessage ?? "Нужный инструмент не предоставлен. Завершаю работу.", "warning", 0);
              mem.llmAction = "false";
              mem.llmMemory.push({ role: "assistant", content: activeStep.noToolMessage ?? "Нет нужного инструмента." });
              break;
            }
          }

          addLog("llm", activeStep.message, "info", 0);
          mem.llmMemory.push({ role: "assistant", content: activeStep.message });
          mem.llmAction = activeStep.llmAction === "false" ? "false" : (activeStep.llmAction || "true");
          if (activeStep.llmAction !== "false" && activeStep.llmAction !== "exit") {
            if (activeStep.requiredTool) {
              const available = activeStep.requiredTool.find((t) => mem.availableTools.includes(t));
              const toolId = available ?? activeStep.requiredTool[0];
              const nodeTypes = TOOL_ID_TO_NODE[toolId];
              mem.lastRequestedTool = nodeTypes ? nodeTypes[nodeTypes.length - 1] : toolId;
            }
          }
          break;
        }

        // --- Condition ---
        case "condition":
          forcePort = mem.llmAction || "false";
          addLog("condition", forcePort === "false" ? "Роутер: Нет активной команды → конец (False)." : `Роутер: Переход на ветку ${forcePort}.`, "info", 0);
          break;

        // --- Tools ---
        case "toolBash":
        case "toolSearch":
        case "toolCreate":
        case "toolRead":
        case "toolWrite":
        case "toolDelete": {
          const matchingSysTools = Object.keys(TOOL_ID_TO_NODE).filter(key => TOOL_ID_TO_NODE[key].includes(ntype));
          const isSysEnabled = matchingSysTools.some(t => mem.availableTools.includes(t));

          if (!isSysEnabled) {
            addLog("system", `ОШИБКА: Инструмент ${ntype} вызван, но он не был включен в блоке System Prompt!`, "error", 0);
            runBroken = true;
            break;
          }

          if (mem.llmAction === "false" || mem.llmAction === "exit" || !mem.llmAction) {
            addLog("system", `ОШИБКА ГРАФА: Блок ${ntype} получил управление, но LLM не инициировала вызов (возможно, инструмент не предоставлен в промпте). Действие пропущено.`, "error", 0);
            break;
          }
          const goesToMH = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data?.type === "messageHistory");
          const toolDef = scenario.toolResults[ntype];
          if (toolDef) {
            if (goesToMH) {
              mem.transientBuffer.push({ role: "tool", content: toolDef.content, toolName: ntype });
              mem.lastRequestedTool = ntype;
              addLog(ntype as any, toolDef.logMessage, "success", 0);
              mem.taskProgress = toolDef.progressUpdate(mem.taskProgress);
            } else {
              addLog("system", "ОШИБКА СВЯЗИ: Результат инструмента не направлен в блок Message History, поэтому он утерян и не попал в буфер!", "warning", 0);
              addLog(ntype as any, `Инструмент выполнен, но результат утерян.`, "warning", 0);
            }
          } else {
            addLog(ntype as any, `Инструмент ${ntype} выполнен.`, "info", 0);
          }
          break;
        }

        // --- Output ---
        case "output":
          addLog("output", "Пайплайн завершён.", "success", 0);
          reachedOutput = true;
          currentNodeId = null;
          break;

        default:
          addLog("system", `Проходим блок: ${ntype}`, "info", 0);
          break;
      }

      if (currentNodeId) {
        let outEdges = edges.filter((e: any) => e.source === currentNodeId);
        if (forcePort) {
          const allowed = [forcePort];
          if (forcePort === "false") allowed.push("exit");
          if (forcePort === "true") allowed.push("search", "bash", "search_bash", "create", "read", "write", "delete");
          if (forcePort === "search_bash") allowed.push("search", "bash");
          if (["search", "bash", "search_bash", "create", "read", "write", "delete"].includes(forcePort)) allowed.push("true");

          outEdges = outEdges.filter((e: any) => allowed.includes(e.sourceHandle));
        }
        if (outEdges.length === 0) {
          if (forcePort === "false" || forcePort === "exit") {
            const outputNode = nodes.find(n => n.data?.type === "output");
            if (outputNode) {
              currentNodeId = outputNode.id;
              continue;
            }
          }
          addLog("system", forcePort ? `Путь завершён: нет исходящей связи для выбранной ветки (${forcePort}).` : "Путь завершён: нет исходящих связей.", "warning", 0);
          break;
        }
        currentNodeId = outEdges[0].target;
      }
    }

    setActiveNodeId(null);

    if (isCancelled()) return { passedRuns: 0, runsCount: 1 };

    if (!runBroken && !reachedOutput) {
      addLog("system", "ЗАДАЧА ПРОВАЛЕНА: ОШИБКА: Работа агента была прервана (блок Output не достигнут).", "error", 0);
      return { passedRuns: 0, runsCount: 1 };
    } else if (!runBroken && scenario.successCondition(mem.taskProgress, mem.activePromptId)) {
      addLog("system", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!", "success", 0);
      return { passedRuns: 1, runsCount: 1 };
    } else {
      addLog("system", `ЗАДАЧА ПРОВАЛЕНА: ${scenario.failMessage(mem.taskProgress, mem.activePromptId)}`, "error", 0);
      return { passedRuns: 0, runsCount: 1 };
    }
  }

  // ----------------------------------------------------
  // Dynamic Email Agent Engine
  // ----------------------------------------------------
  const vulnerabilities = analyzeGraphVulnerabilities(nodes, edges, taskId);

  const testCases: any[] = taskId === "task-7"
    ? Array.from({ length: runsCount }, () => ROUTING_TEST_CASES[Math.floor(Math.random() * ROUTING_TEST_CASES.length)])
    : generateTargetedTestCases(runsCount, vulnerabilities);
  let passedRuns = 0;

  for (let runIndex = 0; runIndex < runsCount; runIndex++) {
    if (isCancelled()) break;

    const randomCase = testCases[runIndex];
    setTestCase(randomCase as any);

    if (runsCount > 1) {
      addLog("system", `=== Запуск ${runIndex + 1} из ${runsCount} ===`, "info", runIndex);
    }
    addLog("system", `Старт пайплайна. Обработка нового письма.`, "info", runIndex);

    const startNode = nodes.find((n) => n.data?.type === "dataInput");
    if (!startNode) {
      addLog("system", "Ошибка: Не найден блок Data Input.", "error", runIndex);
      if (runsCount <= 1) {
        passedRuns = -100;
        break;
      }
      addLog("system", `Запуск ${runIndex + 1} прерван, перехожу к следующему...`, "warning", runIndex);
      continue;
    }

    const sysPromptNode = nodes.find((n) => n.data?.type === "systemPrompt");
    const state = {
      emailRead: taskId === "task-7",
      pendingEmailRead: false,
      emailReadBySubagent: false,
      emailDeleted: false,
      emailReplied: false,
      activePromptId: sysPromptNode?.data?.selectedPromptId || null,
      hasSecurityScanner: false,
      subagentResult: null as "spam" | "not_spam" | "rejected" | null,
      llmAction: null as "read" | "delete" | "write" | "exit" | "subagent" | null,
      llmFailed: false,
      llmActionReason: "",
      dispatcherBlocked: false,
      pendingFeedback: null as string | null,
      dispatcherFeedback: null as string | null,
      transientBuffer: [] as any[],
      llmMemory: [] as any[],
      filesChecked: false,
      fileCreated: false,
      taskType: "email",
      readToolCalled: false,
      deleteToolCalled: false,
    };

    let currentNodeId: string | null = startNode.id;
    let iterations = 0;
    let llmVisits = 0;
    const MAX_ITERATIONS = 50;
    let breakRun = false;

    while (currentNodeId && !isCancelled() && !breakRun) {
      if (iterations++ > MAX_ITERATIONS) {
        addLog("system", "Ошибка: Превышен лимит узлов графа.", "error", runIndex);
        breakRun = true;
        break;
      }

      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) {
        addLog("system", "Ошибка: Произошел разрыв графа.", "error", runIndex);
        breakRun = true;
        break;
      }

      setActiveNodeId(currentNode.id);
      await wait(800);
      if (isCancelled()) break;

      const type = currentNode.data?.type;

      if (type === "llm") {
        llmVisits++;
        if (llmVisits > 5) {
          addLog("system", "Ошибка: Бесконечный цикл. Агент застрял и не может завершить задачу (более 5 обращений к LLM). Скорее всего, результат инструмента не возвращается в Историю сообщений.", "error", runIndex);
          breakRun = true;
          break;
        }
      }

      let forcePort: string | null = null;

      switch (type) {
        case "dataInput":
          addLog("dataInput", `Письмо загружено.\nОт: ${randomCase.from}\nТекст: ${randomCase.body.substring(0, 100)}...`, "info", runIndex);
          break;

        case "systemPrompt":
          state.activePromptId = currentNode.data?.selectedPromptId || null;
          const prompt = SYSTEM_PROMPTS.find(p => p.id === state.activePromptId);
          if (!prompt) {
            state.llmFailed = true;
            addLog("system", "ОШИБКА: Системный промпт не выбран! Агент не знает свою роль и не может работать.", "error", runIndex);
            addLog("systemPrompt", "Промпт не выбран.", "error", runIndex);
            breakRun = true;
            break;
          }
          addLog("systemPrompt", `Применен промпт: ${prompt.label}`, "info", runIndex);
          break;

        case "subagent": {
          const subagentId = currentNode.data?.selectedPromptId;
          if (!subagentId) {
            state.llmFailed = true;
            addLog("system", "ОШИБКА: У Субагента не выбран промпт, он не знает, что делать!", "error", runIndex);
            addLog("subagent", "Я не настроен (отсутствует инструкция/промпт).", "error", runIndex);
            breakRun = true;
            break;
          }
          if (taskId === "task-7") {
            if (subagentId !== "sub_financial_manager") {
              addLog("subagent", "Финансовый менеджер: неверная роль/инструкция.", "warning", runIndex);
              state.subagentResult = "rejected";
              state.transientBuffer.push({ role: "tool", content: "Субагент: Неверная роль.", toolName: "subagent" });
            } else {
              const canRefund = ((randomCase as any).registeredDaysAgo ?? 99) <= 14;
              if (canRefund) {
                state.llmAction = "create" as any;
                forcePort = "true";
                addLog("subagent", `Финансовый менеджер: Заявка одобрена (срок ${(randomCase as any).registeredDaysAgo} дн. <= 14). Инициирую создание возврата.`, "info", runIndex);
              } else {
                state.subagentResult = "rejected" as any;
                forcePort = "false";
                state.transientBuffer.push({ role: "tool", content: "Субагент: В возврате отказано (срок > 14 дней).", toolName: "subagent" });
                addLog("subagent", `Финансовый менеджер: В возврате отказано (срок ${(randomCase as any).registeredDaysAgo} дн. > 14). Транзакция не создается.`, "warning", runIndex);
              }
            }
            break;
          }
          if (!state.pendingEmailRead && !state.emailRead) {
            if (state.activePromptId === "sp_support_smart" && subagentId === "sub_spam_filter") {
              state.pendingEmailRead = true;
              state.emailReadBySubagent = true;
            } else {
              addLog("system", "ОШИБКА: Субагент попытался проанализировать письмо, но его текст еще не был прочитан (нужен блок Чтения).", "error", runIndex);
              addLog("subagent", "Не могу проанализировать письмо: нет текста.", "error", runIndex);
              state.subagentResult = "not_spam";
              breakRun = true;
              break;
            }
          }
          if (subagentId === "sub_scanner" || subagentId === "sub_spam_filter") {
            state.hasSecurityScanner = true;
            const spamTag = randomCase.isSpam ? "[SPAM]" : "[LEGIT]";
            const invoiceTag = randomCase.hasInvoice ? ", [INVOICE: true]" : "";
            const tagStr = subagentId === "sub_scanner" ? `[SPAM: ${randomCase.isSpam}]${invoiceTag}` : spamTag;
            state.subagentResult = randomCase.isSpam ? "spam" : "not_spam";
            state.transientBuffer.push({ role: "tool", content: `Субагент: ${tagStr}`, toolName: "subagent" });
            addLog("subagent", `Субагент проанализировал текст. Результат: ${tagStr}`, "success", runIndex);
          } else {
            state.transientBuffer.push({ role: "tool", content: `Субагент: текст обработан согласно базовой инструкции.`, toolName: "subagent" });
            addLog("subagent", `Субагент проанализировал текст и выполнил общую команду.`, "info", runIndex);
          }
          break;
        }

        case "messageHistory":
          if (state.pendingFeedback) {
            state.dispatcherFeedback = state.pendingFeedback;
            state.pendingFeedback = null;
            if (state.pendingEmailRead) {
              state.emailRead = true;
              state.pendingEmailRead = false;
            }
            addLog("messageHistory", "В историю добавлено сообщение с результатом инструмента.", "success", runIndex);
          } else if (state.pendingEmailRead) {
            state.emailRead = true;
            state.pendingEmailRead = false;
            if (state.emailReadBySubagent) {
              addLog("messageHistory", `История сообщений обновлена. Получен текст письма от субагента: "${randomCase.body}"`, "success", runIndex);
              state.emailReadBySubagent = false;
            } else {
              addLog("messageHistory", "История сообщений обновлена. Текст письма передан в LLM.", "success", runIndex);
            }
          } else {
            addLog("messageHistory", "История сообщений проверена. Новых данных нет.", "info", runIndex);
          }
          break;

        case "llm":
          addLog("llm", "LLM думает...", "info", runIndex);

          if (state.pendingFeedback && !state.dispatcherFeedback) {
            addLog("system", "ВНИМАНИЕ: LLM не видит результат работы инструмента, так как он не был передан через Message History!", "warning", runIndex);
            
            const sysNode2 = nodes.find((n: any) => n.data?.type === "systemPrompt");
            const rawSysTools = sysNode2?.data?.systemPromptTools || [];
            const hasDelete = rawSysTools.includes("delete") || rawSysTools.includes("delete_node");
            
            if (hasDelete) {
              addLog("llm", "Я не получил ответ от инструмента! В целях безопасности решаю УДАЛИТЬ это письмо вслепую.", "warning", runIndex);
              state.llmAction = "delete";
            } else {
              state.llmFailed = true;
              state.llmAction = "exit";
              addLog("llm", "Я не получил ответ от инструмента! Инструмент Delete не предоставлен, завершаю работу с ошибкой.", "error", runIndex);
            }
            state.pendingFeedback = null;
            break;
          }

          await wait(800);
          if (isCancelled()) break;

          if (state.dispatcherFeedback) {
            const fb = state.dispatcherFeedback;
            state.dispatcherFeedback = null;
            const isError = fb.includes("ОШИБКА") || fb.includes("БЛОКИРОВКА");
            if (isError) {
              state.llmAction = "exit";
              addLog("llm", `Получил сообщение: "${fb}". Понял ошибку, завершаю работу.`, "success", runIndex);
              break;
            } else if (fb.toLowerCase().includes("прочитан")) {
              addLog("llm", `Получил результат: "${fb}". Анализирую текст письма...`, "success", runIndex);
            } else {
              state.llmAction = "exit";
              addLog("llm", `Получил результат: "${fb}". Задача выполнена, завершаю цикл.`, "success", runIndex);
              break;
            }
          }

          if (state.pendingEmailRead) {
            addLog("system", "ВНИМАНИЕ: LLM не видит результат инструмента — он не передан через Message History!", "warning", runIndex);
            
            const sysNode2 = nodes.find((n: any) => n.data?.type === "systemPrompt");
            const rawSysTools = sysNode2?.data?.systemPromptTools || [];
            const hasDelete = rawSysTools.includes("delete") || rawSysTools.includes("delete_node");
            
            if (hasDelete) {
              addLog("llm", "Не получил текст письма! Удаляю вслепую.", "warning", runIndex);
              state.llmAction = "delete";
            } else {
              state.llmFailed = true;
              state.llmAction = "exit";
              addLog("llm", "Не получил текст письма! Инструмент Delete не предоставлен, завершаю работу.", "error", runIndex);
            }
          } else if (!state.emailRead) {
            const sysNode2 = nodes.find((n: any) => n.data?.type === "systemPrompt");
            const rawSysTools = sysNode2?.data?.systemPromptTools || [];
            const sysTools2 = rawSysTools.filter((t: string) => {
              const nodeTypes = TOOL_ID_TO_NODE[t];
              if (nodeTypes) {
                return nodeTypes.some(type => nodes.some(n => n.data?.type === type && !n.data?.isGhost));
              }
              return true;
            });
            if (state.activePromptId === "sp_support_smart" && sysTools2.includes("subagent_node")) {
              state.llmAction = "subagent";
              addLog("llm", "Я не знаю содержания письма, но согласно умному промпту поддержки, перенаправляю его чтение и классификацию субагенту.", "info", runIndex);
            } else if (sysTools2.includes("read") || sysTools2.includes("read_node")) {
              state.llmAction = "read";
              addLog("llm", "Я не знаю содержания письма. Запрашиваю инструмент Read.", "info", runIndex);
            } else {
              state.llmFailed = true;
              state.llmAction = "exit";
              addLog("llm", "ОШИБКА: Я не знаю содержания письма, но инструмент чтения (Read) не предоставлен.", "error", runIndex);
            }
          } else {
            if (state.emailDeleted) {
              state.llmAction = "exit";
              addLog("llm", "Письмо уже удалено. Завершаю работу.", "success", runIndex);
              break;
            }
            if (state.emailReplied) {
              state.llmAction = "exit";
              addLog("llm", "Ответ уже отправлен клиенту. Завершаю работу.", "success", runIndex);
              break;
            }

            const sysNode2 = nodes.find((n: any) => n.data?.type === "systemPrompt");
            const rawSysTools2 = sysNode2?.data?.systemPromptTools || [];
            const sysTools2 = rawSysTools2.filter((t: string) => {
              const nodeTypes = TOOL_ID_TO_NODE[t];
              if (nodeTypes) {
                return nodeTypes.some(type => nodes.some(n => n.data?.type === type && !n.data?.isGhost));
              }
              return true;
            });
            const promptDef = SYSTEM_PROMPTS.find((p: any) => p.id === state.activePromptId);
            const isSafe = promptDef?.isSecurityAware || state.hasSecurityScanner;

            if (taskId === "task-7") {
              const isRouter = state.activePromptId === "sp_router";
              
              if (!isRouter) {
                if ((randomCase as any).intent === "spam") {
                  if (sysTools2.includes("delete_node") || sysTools2.includes("delete")) {
                    state.llmAction = "delete";
                    addLog("llm", "Это спам. Удаляю.", "warning", runIndex);
                  } else {
                    state.llmFailed = true;
                    state.llmAction = "exit";
                    addLog("llm", "Нет прав на Delete, завершаю работу.", "error", runIndex);
                  }
                } else {
                  if (sysTools2.includes("write_node") || sysTools2.includes("write")) {
                    state.llmAction = "write";
                    addLog("llm", "Я не знаю точного решения, но пытаюсь ответить клиенту напрямую.", "warning", runIndex);
                  } else {
                    state.llmFailed = true;
                    state.llmAction = "exit";
                    addLog("llm", "Нет прав на Write, завершаю работу.", "error", runIndex);
                  }
                }
                break;
              }

              // Correct router logic
              if ((randomCase as any).intent === "support") {
                if (!state.filesChecked) {
                  if (sysTools2.includes("search_node") || sysTools2.includes("search")) {
                    state.llmAction = "search" as any;
                    addLog("llm", "Технический запрос. Запрашиваю поиск по Базе Знаний.", "info", runIndex);
                  } else {
                    state.llmFailed = true;
                    state.llmAction = "exit";
                    addLog("llm", "ОШИБКА: Нужен поиск, но инструмент Search не предоставлен.", "error", runIndex);
                  }
                } else {
                  if (sysTools2.includes("write_node") || sysTools2.includes("write")) {
                    state.llmAction = "write";
                    addLog("llm", "Решение найдено в Базе Знаний. Отправляю ответ клиенту.", "success", runIndex);
                  } else {
                    state.llmFailed = true;
                    state.llmAction = "exit";
                    addLog("llm", "ОШИБКА: Решение найдено, но инструмент Write не предоставлен.", "error", runIndex);
                  }
                }
              } else if ((randomCase as any).intent === "billing") {
                if (!state.subagentResult && !state.fileCreated) {
                  if (sysTools2.includes("subagent_node") || sysTools2.includes("subagent")) {
                    state.llmAction = "subagent" as any;
                    addLog("llm", "Запрос на возврат. Направляю Финансовому Менеджеру.", "info", runIndex);
                  } else {
                    state.llmFailed = true;
                    state.llmAction = "exit";
                    addLog("llm", "ОШИБКА: Требуется проверка возврата, но субагент не предоставлен.", "error", runIndex);
                  }
                } else {
                  if (sysTools2.includes("write_node") || sysTools2.includes("write")) {
                    state.llmAction = "write";
                    addLog("llm", `Финансовый менеджер завершил проверку (результат: ${state.fileCreated ? "возврат создан" : "отказано"}). Отвечаю клиенту.`, "success", runIndex);
                  } else {
                    state.llmFailed = true;
                    state.llmAction = "exit";
                    addLog("llm", "ОШИБКА: Отчет получен, но инструмент Write не предоставлен.", "error", runIndex);
                  }
                }
              } else if ((randomCase as any).intent === "spam") {
                if (sysTools2.includes("delete_node") || sysTools2.includes("delete")) {
                  state.llmAction = "delete";
                  addLog("llm", "Обнаружен спам. Удаляю обращение.", "success", runIndex);
                } else {
                  state.llmFailed = true;
                  state.llmAction = "exit";
                  addLog("llm", "ОШИБКА: Спам обнаружен, но инструмент Delete не предоставлен.", "error", runIndex);
                }
              }
            } else if (taskId === "task-6") {
              const isSmart = promptDef?.id === "sp_support_smart";
              const hasTag = state.hasSecurityScanner;
              const isDelegating = isSmart && sysTools2.includes("subagent_node");

              if (isDelegating && !hasTag) {
                state.llmAction = "subagent";
                addLog("llm", "Письмо еще не проверено спам-фильтром. Направляю на классификацию субагенту.", "info", runIndex);
                break;
              }

              if (randomCase.isSpam) {
                if (hasTag && isSmart) {
                  state.llmAction = "exit";
                   addLog("llm", "Субагент пометил письмо как СПАМ. Игнорирую его.", "success", runIndex);
                } else if (sysTools2.includes("delete") || sysTools2.includes("delete_node")) {
                  state.llmAction = "delete";
                  addLog("llm", "Это спам. Запрашиваю инструмент Delete.", "info", runIndex);
                } else if (sysTools2.includes("write") || sysTools2.includes("write_node")) {
                  state.llmAction = "write";
                  addLog("llm", "Я не распознал спам (или моя инструкция велит отвечать всем). Отправляю ответ!", "warning", runIndex);
                } else {
                  state.llmFailed = true;
                  state.llmAction = "exit";
                   addLog("llm", "ОШИБКА: Похоже на письмо, но инструмента Write нет. Завершаю работу с ошибкой.", "error", runIndex);
                }
              } else {
                if (sysTools2.includes("write") || sysTools2.includes("write_node")) {
                  state.llmAction = "write";
                   addLog("llm", "Это легитимное письмо от клиента. Формирую и отправляю ответ.", "success", runIndex);
                } else {
                  state.llmFailed = true;
                  state.llmAction = "exit";
                   addLog("llm", "ОШИБКА: Это легитимное письмо, но инструмента Write нет. Не могу ответить.", "error", runIndex);
                }
              }
            } else if (randomCase.forceHallucination) {
              if (sysTools2.includes("delete") || sysTools2.includes("delete_node")) {
                state.llmAction = "delete";
                 addLog("llm", "Галлюцинация: Это спам. Принимаю решение: Удалить письмо.", "warning", runIndex);
              } else {
                state.llmFailed = true;
                state.llmAction = "exit";
                 addLog("llm", "ОШИБКА: Я бы удалил это письмо, но инструмент Delete не предоставлен.", "error", runIndex);
              }
            } else if (!isSafe && Math.random() < 0.2 && !randomCase.isSpam && LEGITIMATE_SENDERS.includes(randomCase.from)) {
              if (sysTools2.includes("delete") || sysTools2.includes("delete_node")) {
                state.llmAction = "delete";
                 addLog("llm", "Галлюцинация: Это спам. Принимаю решение: Удалить письмо.", "warning", runIndex);
              } else {
                state.llmFailed = true;
                state.llmAction = "exit";
                 addLog("llm", "ОШИБКА: Я бы удалил это письмо из осторожности, но инструмент Delete не предоставлен.", "error", runIndex);
              }
            } else {
              if (randomCase.isSpam) {
                if (sysTools2.includes("delete") || sysTools2.includes("delete_node")) {
                  state.llmAction = "delete";
                  addLog("llm", "Это спам. Запрашиваю инструмент Delete.", "info", runIndex);
                } else {
                  state.llmFailed = true;
                  state.llmAction = "exit";
                  addLog("llm", "ОШИБКА: Это спам, но инструмент Delete не предоставлен.", "error", runIndex);
                }
              } else if (randomCase.hasInvoice) {
                state.llmAction = "exit";
                 addLog("llm", "Вижу счет на оплату. Сохраняю письмо и завершаю работу.", "success", runIndex);
              } else {
                state.llmAction = "exit";
                 addLog("llm", "Это обычное письмо. Оставляю его и завершаю работу.", "success", runIndex);
              }
            }
          }
          break;

        case "condition":
          if (currentNode.data?.conditionMode === "spam_filter") {
            forcePort = state.subagentResult === "spam" ? "spam" : "not_spam";
            addLog("condition", `Роутер: Переход на ветку ${forcePort === "spam" ? "SPAM" : "LEGIT"}.`, "info", runIndex);
          } else if (currentNode.data?.conditionMode === "tool_select") {
            if (state.llmAction === "exit" || state.llmAction === null) {
              forcePort = "false";
              addLog("condition", "Роутер: Команд нет, переход на ветку END (False).", "info", runIndex);
            } else {
              forcePort = state.llmAction;
              addLog("condition", `Роутер: Выбран инструмент ${state.llmAction?.toUpperCase() ?? "?"}.`, "info", runIndex);
            }
          } else if (state.llmAction === "subagent") {
            forcePort = "subagent";
            addLog("condition", "Роутер: Выбран инструмент Subagent.", "info", runIndex);
          } else if (state.llmAction === "exit" || state.llmAction === null) {
            forcePort = "false";
            addLog("condition", "Роутер: Команд нет, переход на ветку END (False).", "info", runIndex);
          } else {
            forcePort = "true";
            addLog("condition", "Роутер: Есть команда, переход на ветку TOOLS (True).", "info", runIndex);
          }
          break;

        case "dispatcher": {
          const sysNode2 = nodes.find((n: any) => n.data?.type === "systemPrompt");
          const rawSysTools = sysNode2?.data?.systemPromptTools || [];
          const goesToMH = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data?.type === "messageHistory");
          const tools = currentNode.data?.dispatcherTools || [];

          const pushResult = (result: string, toolName: string, isError: boolean, stateUpdater: () => void, isBlock: boolean = false) => {
            stateUpdater();
            if (goesToMH) {
              state.pendingFeedback = result;
              addLog("dispatcher", result, isBlock ? "error" : isError ? "error" : "warning", runIndex);
            } else {
              addLog("system", "ОШИБКА СВЯЗИ: Результат инструмента не направлен в блок Message History, поэтому он утерян!", "warning", runIndex);
              addLog("dispatcher", `Результат "${result}" утерян из-за отсутствия связи с Message History.`, "warning", runIndex);
            }
          };

          if (state.llmAction === "read") {
            state.readToolCalled = true;
            const isSysEnabled = rawSysTools.includes("read") || rawSysTools.includes("read_node");
            if (!isSysEnabled) {
              pushResult(`ОШИБКА: Инструмент Read не включен в System Prompt!`, "read", true, () => {});
              state.llmAction = null;
              state.llmFailed = true;
              breakRun = true;
            } else if (tools.includes("read")) {
              pushResult("Инструмент Read выполнен успешно. Текст письма прочитан.", "read", false, () => { state.pendingEmailRead = true; });
              state.llmAction = null;
            } else {
              pushResult(`ОШИБКА: Инструмент Read запрещен настройками!`, "read", true, () => { });
              state.llmAction = null;
            }
          } else if (state.llmAction === "delete") {
            state.deleteToolCalled = true;
            const isSysEnabled = rawSysTools.includes("delete") || rawSysTools.includes("delete_node");
            if (!isSysEnabled) {
              pushResult(`ОШИБКА: Инструмент Delete не включен в System Prompt!`, "delete", true, () => {});
              state.llmAction = null;
              state.llmFailed = true;
              breakRun = true;
            } else if (tools.includes("delete")) {
              const protectedEmails = currentNode.data?.dispatcherProtectedEmails || [];
              if (protectedEmails.some((e: string) => isEmailMatch(e, randomCase.from))) {
                 pushResult(`БЛОКИРОВКА: Попытка удалить письмо от защищенного контакта (${randomCase.from})!`, "delete", true, () => { state.dispatcherBlocked = true; }, true);
                state.llmAction = null;
              } else {
                 pushResult(`Инструмент Delete выполнен успешно. Письмо удалено.`, "delete", false, () => { state.emailDeleted = true; });
                state.llmAction = null;
              }
            } else {
              pushResult(`ОШИБКА: Инструмент Delete запрещен настройками!`, "delete", true, () => { });
              state.llmAction = null;
            }
          } else if (state.llmAction === "write") {
            const isSysEnabled = rawSysTools.includes("write") || rawSysTools.includes("write_node");
            if (!isSysEnabled) {
              pushResult(`ОШИБКА: Инструмент Write не включен в System Prompt!`, "write", true, () => {});
              state.llmAction = null;
              state.llmFailed = true;
              breakRun = true;
            } else if (tools.includes("write")) {
              pushResult(`Инструмент Write выполнен успешно. Ответ отправлен.`, "write", false, () => { state.emailReplied = true; });
              state.llmAction = null;
            } else {
              pushResult(`ОШИБКА: Инструмент Write запрещен настройками!`, "write", true, () => { });
              state.llmAction = null;
            }
          }
          break;
        }

        case "toolRead":
        case "toolDelete":
        case "toolBash":
        case "toolSearch":
        case "toolCreate":
        case "toolWrite": {
          const sysNode2 = nodes.find((n: any) => n.data?.type === "systemPrompt");
          const rawSysTools = sysNode2?.data?.systemPromptTools || [];
          
          let isToolEnabled = false;
          if (type === "toolRead" && (rawSysTools.includes("read") || rawSysTools.includes("read_node"))) isToolEnabled = true;
          if (type === "toolDelete" && (rawSysTools.includes("delete") || rawSysTools.includes("delete_node"))) isToolEnabled = true;
          if (type === "toolWrite" && (rawSysTools.includes("write") || rawSysTools.includes("write_node"))) isToolEnabled = true;
          if (type === "toolBash" && rawSysTools.includes("bash_node")) isToolEnabled = true;
          if (type === "toolSearch" && rawSysTools.includes("search_node")) isToolEnabled = true;
          if (type === "toolCreate" && rawSysTools.includes("create_node")) isToolEnabled = true;

          if (!isToolEnabled) {
            addLog("system", `ОШИБКА: Инструмент ${type} вызван, но он не был включен в блоке System Prompt!`, "error", runIndex);
            state.llmFailed = true;
            breakRun = true;
            break;
          }

          const goesToMH = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data?.type === "messageHistory");
          const goesToSubagent = edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data?.type === "subagent");
          const goesToKB = taskId === "task-7" && edges.some((e: any) => e.source === currentNodeId && nodes.find((n: any) => n.id === e.target)?.data?.type === "knowledgeBase");

          const pushToolResult = (result: string, toolName: string, actionMsg: string, stateUpdater: () => void, isWarn: boolean = false) => {
            stateUpdater();
            if (goesToMH || goesToSubagent || goesToKB) {
              if (goesToKB) {
                state.transientBuffer.push({ role: "tool", content: result, toolName: type });
              } else {
                state.pendingFeedback = result;
              }
              addLog(type as any, actionMsg, isWarn ? "warning" : "info", runIndex);
            } else {
              addLog("system", "ОШИБКА СВЯЗИ: Результат инструмента не направлен в блок Message History, поэтому он утерян!", "warning", runIndex);
              addLog(type as any, `Действие выполнено, но результат утерян.`, "warning", runIndex);
            }
          };

          if (type === "toolRead") {
             state.readToolCalled = true;
             pushToolResult("Прочитан текст письма напрямую.", "toolRead", "Прочитан текст письма напрямую.", () => { state.pendingEmailRead = true; });
          } else if (type === "toolWrite") {
            pushToolResult("Ответ успешно отправлен.", "toolWrite", "Ответ успешно отправлен клиенту.", () => { state.emailReplied = true; });
          } else if (type === "toolDelete") {
             state.deleteToolCalled = true;
             pushToolResult("Письмо удалено напрямую через инструмент Delete.", "toolDelete", "Письмо удалено напрямую через инструмент Delete.", () => { state.emailDeleted = true; }, true);
          } else if (type === "toolBash" || type === "toolSearch") {
            const fileRes = taskId === "task-2" ? "Получены файлы: src, package.json, README.md." : "Файл 'счет на оплату' не найден.";
            const msg = taskId === "task-2"
              ? (type === "toolBash"
                ? "Выполнена команда ls. Найдено 3 файла: src, package.json, README.md."
                : "Выполняю поиск файлов. Найдено 3 файла.")
              : "Ищу 'счет на оплату'. Файл не найден.";
            pushToolResult(fileRes, type, msg, () => { state.filesChecked = true; });
          } else if (type === "toolCreate") {
            pushToolResult("Создан файл 'счет на оплату'.", "toolCreate", "Создан файл 'счет на оплату'.", () => { state.fileCreated = true; });
          }
          break;
        }

        case "output":
          addLog("output", "Достигнут конец пайплайна.", "success", runIndex);
          currentNodeId = null;
          break;

        case "knowledgeBase": {
          if (taskId === "task-7") {
            const article = (randomCase as any).kbArticle ?? "Статья не найдена.";
            state.transientBuffer.push({ role: "tool", content: `База Знаний: ${article}`, toolName: "knowledgeBase" });
            addLog("knowledgeBase", `База Знаний: Извлечена статья: "${article}"`, "success", runIndex);
          } else {
            addLog("system", `Проходим блок: ${type}`, "info", runIndex);
          }
          break;
        }

        default:
          addLog("system", `Проходим блок: ${type}`, "info", runIndex);
          break;
      }

      if (currentNodeId) {
        let outgoingEdges = edges.filter((e) => e.source === currentNodeId);
        if (forcePort) {
          const allowed: string[] = [forcePort];
          if (forcePort === "false") allowed.push("exit", "subagent");
          if (forcePort === "true") allowed.push("search", "bash", "search_bash", "create", "read", "write", "delete", "subagent");
          if (forcePort === "search_bash") allowed.push("search", "bash");
          if (["search", "bash", "search_bash", "create", "read", "write", "delete", "subagent"].includes(forcePort)) allowed.push("true");
          if (forcePort === "subagent") allowed.push("false");
          if (forcePort === "spam") allowed.push("spam");
          if (forcePort === "not_spam") allowed.push("not_spam");

          outgoingEdges = outgoingEdges.filter((e) => allowed.includes(e.sourceHandle));
        }

        // DISAMBIGUATION: If multiple edges match, prioritize the one whose target node type matches the requested tool, or goes to messageHistory if null
        const requestedTool = state.llmAction as string | null;
        if (outgoingEdges.length > 1) {
          if (requestedTool) {
            const toolToNodeType: Record<string, string> = {
              read: "toolRead",
              write: "toolWrite",
              delete: "toolDelete",
              search_bash: "toolBash",
              search: "toolSearch",
              create: "toolCreate",
              subagent: "subagent"
            };
            const expectedType = toolToNodeType[requestedTool];
            if (expectedType) {
              let matchedEdge = outgoingEdges.find(e => {
                const targetNode = nodes.find(n => n.id === e.target);
                const targetType = targetNode?.data?.type;
                if (requestedTool === "search_bash") {
                  return targetType === "toolBash" || targetType === "toolSearch";
                }
                return targetType === expectedType;
              });
              // Fallback: If no standalone tool matches, but there is a dispatcher, route to it
              if (!matchedEdge) {
                matchedEdge = outgoingEdges.find(e => {
                  const targetNode = nodes.find(n => n.id === e.target);
                  return targetNode?.data?.type === "dispatcher";
                });
              }

              if (matchedEdge) {
                outgoingEdges = [matchedEdge];
              }
            }
          } else {
            // Prioritize edge pointing to messageHistory when no active tool is requested
            const mhEdge = outgoingEdges.find(e => {
              const targetNode = nodes.find(n => n.id === e.target);
              return targetNode?.data?.type === "messageHistory";
            });
            if (mhEdge) {
              outgoingEdges = [mhEdge];
            }
          }
        }

        if (outgoingEdges.length === 0) {
          if (forcePort === "false" || forcePort === "exit") {
            const outputNode = nodes.find(n => n.data?.type === "output");
            if (outputNode) {
              currentNodeId = outputNode.id;
              continue;
            }
          }
          addLog("system", forcePort ? `Путь завершен: нет исходящей связи для выбранной ветки (${forcePort}).` : "Путь завершен (нет исходящих связей).", "warning", runIndex);
          break;
        }

        currentNodeId = outgoingEdges[0].target;
      }
    }

    if (breakRun || isCancelled()) {
      if (runsCount <= 1 || isCancelled()) {
        passedRuns = -100;
        break;
      }
      addLog("system", `Запуск ${runIndex + 1} прерван критической ошибкой, перехожу к следующему...`, "warning", runIndex);
    }

    let runPassed = true;
    let feedback = [];
    const isImmuneRequired = getRequiredProtectedEmails(taskId).some(e => isEmailMatch(e, randomCase.from));

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
      if (taskId === "task-7") {
        const isRouter = state.activePromptId === "sp_router";
        if (!isRouter) {
          runPassed = false;
          feedback.push("ОШИБКА: Системный промпт не настроен на роль Маршрутизатора.");
        } else if ((randomCase as any).intent === "support") {
          const hasKB = edges.some(e => {
            const srcNode = nodes.find(n => n.id === e.source);
            const tgtNode = nodes.find(n => n.id === e.target);
            return srcNode?.data?.type === "toolSearch" && tgtNode?.data?.type === "knowledgeBase";
          });
          if (!state.filesChecked) {
            runPassed = false;
            feedback.push("ОШИБКА: Поиск в базе знаний не был запущен для технического запроса.");
          } else if (!hasKB) {
            runPassed = false;
            feedback.push("ОШИБКА: База Знаний не подключена на выходе из инструмента поиска.");
          } else if (!state.emailReplied) {
            runPassed = false;
            feedback.push("ОШИБКА: Решение не было отправлено клиенту.");
          } else {
            feedback.push("Успешно: Технический запрос решен с помощью Базы Знаний.");
          }
        } else if ((randomCase as any).intent === "billing") {
          const subagentNode = nodes.find(n => n.data?.type === "subagent");
          const isFinManager = subagentNode?.data?.selectedPromptId === "sub_financial_manager";
          if (!isFinManager) {
            runPassed = false;
            feedback.push("ОШИБКА: Запрос возврата не был передан субагенту Финансового Менеджера.");
          } else {
            const isRefundApproved = ((randomCase as any).registeredDaysAgo ?? 99) <= 14;
            if (isRefundApproved) {
              if (!state.fileCreated) {
                runPassed = false;
                feedback.push("ОШИБКА: Возврат одобрен, но транзакция не создана.");
              } else if (!state.emailReplied) {
                runPassed = false;
                feedback.push("ОШИБКА: Подтверждение возврата не отправлено клиенту.");
              } else {
                feedback.push("Успешно: Возврат средств одобрен и успешно создан субагентом.");
              }
            } else {
              if (state.fileCreated) {
                runPassed = false;
                feedback.push("КРИТИЧЕСКАЯ ОШИБКА: Возврат был одобрен в обход лимита 14 дней!");
              } else if (!state.emailReplied) {
                runPassed = false;
                feedback.push("ОШИБКА: Отказ в возврате не отправлен клиенту.");
              } else {
                feedback.push("Успешно: В возврате отказано согласно правилам компании.");
              }
            }
          }
        } else if ((randomCase as any).intent === "spam") {
          if (!state.emailDeleted) {
            runPassed = false;
            feedback.push("ОШИБКА: Спам-обращение не было удалено.");
          } else if (state.emailReplied) {
            runPassed = false;
            feedback.push("ОШИБКА: Вы отправили ответ на спам-обращение.");
          } else {
            feedback.push("Успешно: Спам удален без ответа.");
          }
        }
      } else if (state.llmFailed) {
        runPassed = false;
        feedback.push("ОШИБКА: Агент не смог выполнить действие из-за нехватки инструментов.");
      } else if (taskId === "task-6") {
        const usedDelegation = state.hasSecurityScanner && !state.readToolCalled && !state.deleteToolCalled;

        if (randomCase.isSpam && state.emailReplied) {
          runPassed = false;
          feedback.push("ОШИБКА: Вы отправили ответ на спам.");
        } else if (!randomCase.isSpam && !state.emailReplied) {
          runPassed = false;
          feedback.push("ОШИБКА: Вы НЕ отправили ответ клиенту.");
        } else if (!usedDelegation) {
          runPassed = false;
          if (!state.hasSecurityScanner) {
            feedback.push("ОШИБКА: Вы не поручили чтение и фильтрацию спама субагенту. Основной смысл задачи — научить агента делегированию.");
          } else if (state.readToolCalled) {
            feedback.push("ОШИБКА: Основной агент не должен самостоятельно вызывать инструмент Read. Чтение письма должно быть делегировано субагенту.");
          } else {
            feedback.push("ОШИБКА: Основной агент не должен самостоятельно вызывать инструмент Delete. Удаление спама должно происходить на уровне маршрутизации результатов субагента.");
          }
        } else if (randomCase.isSpam) {
          feedback.push("Молодец! Спам проигнорирован.");
        } else {
          feedback.push("Молодец! Ответ клиенту успешно отправлен.");
        }
      } else if (!state.emailRead) {
        runPassed = false;
        feedback.push("ОШИБКА: Письмо не было прочитано.");
      } else if (isImmuneRequired) {
        if (state.emailDeleted) {
          runPassed = false;
          feedback.push(`КРИТИЧЕСКАЯ ОШИБКА: Было удалено письмо от защищенного контакта (${randomCase.from})!`);
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
          feedback.push("КРИТИЧЕСКАЯ ОШИБКА: Было удалено письмо со счетом на оплату!");
        } else {
          feedback.push("Молодец! Вы сохранили письмо со счетом.");
        }
      } else {
        if (state.emailDeleted) {
          runPassed = false;
          feedback.push("ОШИБКА: Вы удалили нормальное письмо.");
        } else {
          feedback.push("Молодец! Нормальное письмо осталось в системе.");
        }
      }
    }

    if (runPassed) {
      passedRuns++;
      addLog("system", `Запуск ${runIndex + 1} пройден успешно! ${feedback.join(" ")}`, "success", runIndex);
    } else {
      addLog("system", `Запуск ${runIndex + 1} провален: ${feedback.join(" ")}`, "error", runIndex);
    }
  }

  if (isCancelled()) return { passedRuns: 0, runsCount };

  setActiveNodeId(null);

  if (passedRuns === runsCount) {
    addLog("system", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!", "success", -1);
  } else if (passedRuns >= 0) {
    addLog("system", `ЗАДАЧА ПРОВАЛЕНА: Пройдено ${passedRuns} из ${runsCount} тестов.`, "error", -1);
  } else {
    addLog("system", "ЗАДАЧА ПРОВАЛЕНА.", "error", -1);
  }

  return { passedRuns, runsCount };
}
