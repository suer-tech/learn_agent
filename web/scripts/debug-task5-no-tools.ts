import { runSimulationEngine, LogEntry } from "../src/lib/simulator/engine";

/**
 * СЦЕНАРИЙ 1: systemPromptTools = []  (пустой массив)
 * СЦЕНАРИЙ 2: systemPromptTools = undefined (поле отсутствует)
 * СЦЕНАРИЙ 3: systemPrompt блок отсутствует вообще
 * СЦЕНАРИЙ 4: Тулы на карте как standalone (без dispatcher)
 */

const baseEdges = [
  { source: "n1", target: "n3" },
  { source: "n2", target: "n3" },
  { source: "n3", target: "n4" },
  { source: "n4", target: "n5" },
  { source: "n5", target: "n6", sourceHandle: "true" },
  { source: "n6", target: "n7", sourceHandle: "read" },
  { source: "n7", target: "n3" },
  { source: "n6", target: "n8", sourceHandle: "delete" },
  { source: "n8", target: "n9" },
  { source: "n6", target: "n3" },
  { source: "n5", target: "n9", sourceHandle: "false" }
];

function makeCallbacks() {
  const logs: { source: string; message: string; type: string }[] = [];
  return {
    logs,
    callbacks: {
      addLog: (source: any, message: string, type: any, runIndex?: number) => {
        logs.push({ source, message, type });
      },
      setActiveNodeId: () => {},
      setTestCase: () => {},
      isCancelled: () => false,
      delay: async () => {},
    }
  };
}

async function testScenario(name: string, nodes: any[], edges: any[]) {
  const { logs, callbacks } = makeCallbacks();
  console.log(`\n--- ${name} ---`);
  
  const res = await runSimulationEngine(nodes, edges, 1, "agent-loop-basic", callbacks);
  
  const llmRequestedRead = logs.some(l => l.source === "llm" && l.message.includes("Запрашиваю инструмент Read"));
  const llmNoTool = logs.some(l => l.source === "llm" && l.message.includes("не предоставлен"));
  const toolExecuted = logs.some(l => (l.source === "toolRead" || l.source === "dispatcher") && l.message.includes("выполнен"));
  
  if (llmRequestedRead || toolExecuted) {
    console.log(`  ❌ ОШИБКА: LLM вызвала инструмент!`);
    logs.filter(l => l.source === "llm" || l.source === "toolRead" || l.source === "dispatcher").forEach(l => {
      console.log(`     [${l.source}] ${l.message}`);
    });
    return false;
  } else if (llmNoTool) {
    console.log(`  ✅ OK: LLM корректно отказалась (нет инструментов)`);
    return true;
  } else {
    console.log(`  ⚠️ НЕИЗВЕСТНО:`);
    logs.forEach(l => console.log(`     [${l.source}] (${l.type}) ${l.message}`));
    return false;
  }
}

async function main() {
  let allPassed = true;

  // Сценарий 1: systemPromptTools = []
  allPassed = await testScenario("Сценарий 1: systemPromptTools = []", [
    { id: "n1", data: { type: "dataInput" } },
    { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: [] } },
    { id: "n3", data: { type: "messageHistory" } },
    { id: "n4", data: { type: "llm" } },
    { id: "n5", data: { type: "condition" } },
    { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: [] } },
    { id: "n7", data: { type: "toolRead" } },
    { id: "n8", data: { type: "toolDelete" } },
    { id: "n9", data: { type: "output" } }
  ], baseEdges) && allPassed;

  // Сценарий 2: systemPromptTools = undefined (как будто ноду только создали)
  allPassed = await testScenario("Сценарий 2: systemPromptTools отсутствует (undefined)", [
    { id: "n1", data: { type: "dataInput" } },
    { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic" } }, // НЕТ systemPromptTools!
    { id: "n3", data: { type: "messageHistory" } },
    { id: "n4", data: { type: "llm" } },
    { id: "n5", data: { type: "condition" } },
    { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: [] } },
    { id: "n7", data: { type: "toolRead" } },
    { id: "n8", data: { type: "toolDelete" } },
    { id: "n9", data: { type: "output" } }
  ], baseEdges) && allPassed;

  // Сценарий 3: Нет блока systemPrompt вообще
  allPassed = await testScenario("Сценарий 3: Блок systemPrompt отсутствует", [
    { id: "n1", data: { type: "dataInput" } },
    { id: "n3", data: { type: "messageHistory" } },
    { id: "n4", data: { type: "llm" } },
    { id: "n5", data: { type: "condition" } },
    { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: [] } },
    { id: "n7", data: { type: "toolRead" } },
    { id: "n8", data: { type: "toolDelete" } },
    { id: "n9", data: { type: "output" } }
  ], baseEdges.filter(e => e.source !== "n2")) && allPassed;

  // Сценарий 4: Без dispatcher, standalone тулы, systemPromptTools = []
  allPassed = await testScenario("Сценарий 4: Standalone toolRead/toolDelete, systemPromptTools = []", [
    { id: "n1", data: { type: "dataInput" } },
    { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: [] } },
    { id: "n3", data: { type: "messageHistory" } },
    { id: "n4", data: { type: "llm" } },
    { id: "n5", data: { type: "condition" } },
    { id: "n7", data: { type: "toolRead" } },
    { id: "n8", data: { type: "toolDelete" } },
    { id: "n9", data: { type: "output" } }
  ], [
    { source: "n1", target: "n3" },
    { source: "n2", target: "n3" },
    { source: "n3", target: "n4" },
    { source: "n4", target: "n5" },
    { source: "n5", target: "n7", sourceHandle: "true" },
    { source: "n7", target: "n3" },
    { source: "n5", target: "n9", sourceHandle: "false" }
  ]) && allPassed;

  console.log(`\n=== ИТОГ: ${allPassed ? "🟢 Все сценарии прошли" : "🔴 Есть провалы"} ===\n`);
  process.exit(allPassed ? 0 : 1);
}

main();
