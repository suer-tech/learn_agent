/**
 * Проверка ВСЕХ 4 сценариев:
 * Каждый из 4 контактов по очереди остаётся незащищённым.
 * При 1 запуске атака ДОЛЖНА идти именно на него.
 */
import { runSimulationEngine, analyzeGraphVulnerabilities, LogEntry } from "../src/lib/simulator/engine";

const ALL_CONTACTS = ["@ceo_official", "@alex_manager", "@aws_billing", "@sarah_dev"];
const EXPECTED_SENDERS: Record<string, string> = {
  "@ceo_official": "ceo@company.com",
  "@alex_manager": "alex.manager@company.com",
  "@aws_billing": "billing@aws.amazon.com",
  "@sarah_dev": "sarah.dev@company.com",
};

function makeGraph(protectedEmails: string[]) {
  return {
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: protectedEmails } },
      { id: "n7", data: { type: "output" } },
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n7", sourceHandle: "false" },
    ],
  };
}

async function testUnprotected(unprotectedHandle: string) {
  const protected3 = ALL_CONTACTS.filter(c => c !== unprotectedHandle);
  const expectedFrom = EXPECTED_SENDERS[unprotectedHandle];
  const { nodes, edges } = makeGraph(protected3);

  const allLogs: LogEntry[] = [];
  let testCase: any = null;

  const res = await runSimulationEngine(nodes, edges, 1, "agent-loop-basic", {
    addLog: (source, message, type, runIdx) => {
      allLogs.push({ id: String(allLogs.length), timestamp: Date.now(), source, message, type, runIndex: runIdx });
    },
    setActiveNodeId: () => {},
    setTestCase: (tc) => { testCase = tc; },
    isCancelled: () => false,
    delay: async () => {},
  });

  const attackedCorrectSender = testCase?.from === expectedFrom;
  const hadHallucination = testCase?.forceHallucination === true;
  const hasCriticalError = allLogs.some(l => l.message.includes("КРИТИЧЕСКАЯ ОШИБКА"));
  const runFailed = res.passedRuns === 0;

  const ok = attackedCorrectSender && hadHallucination && hasCriticalError && runFailed;

  console.log(`${ok ? "✅" : "❌"} Незащищён ${unprotectedHandle.padEnd(15)} → письмо от: ${(testCase?.from || "???").padEnd(28)} hallucination=${String(hadHallucination).padEnd(5)} крит.ошибка=${String(hasCriticalError).padEnd(5)} провал=${runFailed}`);
  
  if (!ok) {
    console.log(`   ОЖИДАЛИ: от=${expectedFrom}`);
    console.log(`   ПОЛУЧИЛИ: от=${testCase?.from}`);
    allLogs.forEach(l => console.log(`   [${l.source}] ${l.message}`));
  }

  return ok;
}

async function main() {
  console.log("=== ТЕСТ: Атака на каждый незащищённый контакт (1 запуск) ===\n");

  let allOk = true;
  for (const contact of ALL_CONTACTS) {
    const ok = await testUnprotected(contact);
    if (!ok) allOk = false;
  }

  console.log(`\n${allOk ? "✅ ВСЕ 4 АТАКИ КОРРЕКТНЫ" : "❌ ЕСТЬ ПРОВАЛЫ"}`);
  process.exit(allOk ? 0 : 1);
}

main();
