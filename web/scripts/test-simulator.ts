import { REGRESSION_TESTS } from "../src/lib/simulator/verification";
import { runSimulationEngine, analyzeGraphVulnerabilities, LogEntry } from "../src/lib/simulator/engine";
import { TASK_SCENARIOS } from "../src/hooks/taskScenarios";
import { TASK_REQUIREMENTS } from "../src/lib/simulator/taskRequirements";


// Basic color helper
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
};

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   АГЕНТ-СИМУЛЯТОР: СИСТЕМА РЕГРЕССИОННЫХ ТЕСТОВ   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  let totalTests = REGRESSION_TESTS.length;
  let passedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < totalTests; i++) {
    const test = REGRESSION_TESTS[i];
    console.log(`${colors.bold}${colors.white}[Тест ${i + 1}/${totalTests}] ${test.name}...${colors.reset}`);

    const testLogs: LogEntry[] = [];
    let activeNode: string | null = null;
    let selectedTestCase: any = null;

    // Run vulnerabilities check
    const vulnerabilities = analyzeGraphVulnerabilities(test.nodes, test.edges, test.taskId);

    // Callbacks for decoupled engine
    const callbacks = {
      addLog: (source: any, message: string, type: any, runIdx?: number) => {
        testLogs.push({
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          source,
          message,
          type,
          runIndex: runIdx,
        });
      },
      setActiveNodeId: (nodeId: string | null) => {
        activeNode = nodeId;
      },
      setTestCase: (tCase: any) => {
        selectedTestCase = tCase;
      },
      isCancelled: () => false,
      delay: async () => {}, // ZERO DELAY for instant test execution!
    };

    let passed = false;
    let errorMsg = "";

    try {
      // Execute the decoupled engine
      const res = await runSimulationEngine(test.nodes, test.edges, test.runsCount, test.taskId, callbacks);
      
      const realNodes = test.nodes.filter(n => !n.data?.isGhost);
      
      // Local validation logic matching trainer.tsx
      let missingBlocks: string[] = [];
      let missingEdges: any[] = [];
      
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
      } else if (test.taskId === "task-3-files") {
        const sysPromptNode = test.nodes.find(n => n.data?.type === "systemPrompt");
        const sysTools = sysPromptNode?.data?.systemPromptTools || [];
        if (!sysTools.includes("create_node") || (!sysTools.includes("bash_node") && !sysTools.includes("search_node"))) {
          missingBlocks.push("missing_file_permissions");
        }
      } else if (test.taskId === "task-4") {
        // Handled by vulnerabilities below
      }

      const hasVulnerabilityError = !TASK_SCENARIOS[test.taskId] && (test.id !== "task-4-perfect") && vulnerabilities.length > 0 && (
        test.taskId === "task-4" || 
        vulnerabilities.some(v => v.type === "missing_message_history" || v.type === "no_dispatcher" || v.type === "unprotected_sender")
      );

      passed = (res.passedRuns === test.runsCount) && missingBlocks.length === 0 && !hasVulnerabilityError;
    } catch (e: any) {
      passed = false;
      errorMsg = e.message;
    }

    // ==========================================
    // ASSERTIONS
    // ==========================================
    let assertionsPassed = true;
    const failureReasons: string[] = [];

    // 1. Assert result status
    if (passed !== test.expected.passed) {
      assertionsPassed = false;
      failureReasons.push(`Не совпал статус прохождения: ожидали ${test.expected.passed ? "УСПЕХ" : "ПРОВАЛ"}, получили ${passed ? "УСПЕХ" : "ПРОВАЛ"}`);
    }

    // 2. Assert log substrings
    if (test.expected.expectedLogs) {
      for (const expectedLog of test.expected.expectedLogs) {
        const logFound = testLogs.some(l => l.message.includes(expectedLog));
        if (!logFound) {
          assertionsPassed = false;
          failureReasons.push(`Ожидаемая строка лога не найдена: "${expectedLog}"`);
        }
      }
    }

    // 3. Assert vulnerabilities
    if (test.expected.expectedVulnerabilities) {
      for (const expectedVuln of test.expected.expectedVulnerabilities) {
        const vulnFound = vulnerabilities.some(v => v.type === expectedVuln);
        if (!vulnFound) {
          assertionsPassed = false;
          failureReasons.push(`Ожидаемая уязвимость не обнаружена: "${expectedVuln}"`);
        }
      }
    }

    if (assertionsPassed) {
      passedCount++;
      console.log(`  ${colors.green}✓ ТЕСТ ПРОЙДЕН${colors.reset}\n`);
    } else {
      failedCount++;
      console.log(`  ${colors.red}✗ ТЕСТ ПРОВАЛЕН${colors.reset}`);
      console.log(`  ${colors.bold}${colors.red}Причины провала:${colors.reset}`);
      failureReasons.forEach(r => console.log(`    - ${r}`));
      if (errorMsg) {
        console.log(`    - Исключение: ${errorMsg}`);
      }
      console.log(`  ${colors.yellow}Все логи симулятора:${colors.reset}`);
      testLogs.forEach(l => {
        console.log(`    [${l.source}] ${l.message}`);
      });
      console.log();
    }
  }

  let matrixTestsTotal = 0;
  let matrixTestsPassed = 0;

  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}        ЗАПУСК ДИНАМИЧЕСКИХ МАТРИЧНЫХ ТЕСТОВ        ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  for (const req of TASK_REQUIREMENTS) {
    if (req.requiredProtectedEmails.length > 0) {
      console.log(`${colors.bold}${colors.yellow}Матрица для задачи: ${req.taskId}${colors.reset}`);
      for (const unprotected of req.requiredProtectedEmails) {
        matrixTestsTotal++;
        const protectedList = req.requiredProtectedEmails.filter(e => e !== unprotected);
        
        // 1. Сборка графа
        const nodes = [
          { id: "n1", data: { type: "dataInput" } },
          { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete", "write"] } },
          { id: "n3", data: { type: "messageHistory" } },
          { id: "n4", data: { type: "llm" } },
          { id: "n5", data: { type: "condition" } },
          { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: protectedList } },
          { id: "n7", data: { type: "output" } }
        ];

        // 2. Анализ
        const vulns = analyzeGraphVulnerabilities(nodes, [], req.taskId);
        const hasUnprotected = vulns.some(v => v.type === "unprotected_sender" && v.sender === unprotected);
        
        if (hasUnprotected) {
          matrixTestsPassed++;
          console.log(`  ${colors.green}✓ Найдена уязвимость (отсутствует ${unprotected})${colors.reset}`);
        } else {
          console.log(`  ${colors.red}✗ Уязвимость НЕ найдена (отсутствует ${unprotected})${colors.reset}`);
          failedCount++;
        }
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}                 ИТОГИ ТЕСТИРОВАНИЯ                 ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`Регрессионных тестов: ${totalTests}`);
  console.log(`Матричных тестов:     ${matrixTestsTotal}`);
  console.log(`Успешно:              ${passedCount + matrixTestsPassed === totalTests + matrixTestsTotal ? colors.green : colors.reset}${passedCount + matrixTestsPassed}${colors.reset}`);
  console.log(`Сбоев:                ${failedCount > 0 ? colors.red : colors.reset}${failedCount}${colors.reset}`);
  console.log(`Время выполнения: ${duration} сек`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
