import { runSimulationEngine, analyzeGraphVulnerabilities, generateTargetedTestCases, isEmailMatch } from "../src/lib/simulator/engine";
import { EMAIL_TEST_CASES } from "../src/lib/simulator/emails";

const required = ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"];

for (const req of required) {
  const match = EMAIL_TEST_CASES.find(c => isEmailMatch(c.from, req) && !c.isSpam);
  const matchSpam = EMAIL_TEST_CASES.find(c => isEmailMatch(c.from, req) && c.isSpam);
  console.log(`Req: ${req} | Match !spam: ${match?.from} | Match spam: ${matchSpam?.from}`);
}

async function testScenario() {
  // Mock graph where user forgot to protect alex.manager
  let nodes: any[] = [];
  let edges: any[] = [];
  for (const unprotected of ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"]) {
    const protectedEmails = ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"].filter(e => e !== unprotected);
    nodes = [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "messageHistory" } },
      { id: "n3", data: { type: "llm" } },
      { id: "n3_read", data: { type: "toolRead" } },
      { id: "n3_delete", data: { type: "toolDelete" } },
      { id: "n4", data: { type: "systemPrompt", selectedPromptId: "sp_support_smart", systemPromptTools: ["read", "delete"] } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: protectedEmails } },
      { id: "n7", data: { type: "output" } }
    ];

    edges = [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n4" },
      { source: "n4", target: "n3" },
      { source: "n3", target: "n5" },
      { source: "n5", target: "n6" },
      { source: "n6", target: "n7" },
      { source: "n6", target: "n3_delete" },
      { source: "n3_delete", target: "n7" },
      { source: "n6", target: "n3_read" },
      { source: "n3_read", target: "n3" }
    ];

    const vulnerabilities = analyzeGraphVulnerabilities(nodes, edges, "agent-loop-basic");
    const testCases = generateTargetedTestCases(1, vulnerabilities);
    console.log(`Unprotected: ${unprotected} => Test Case From: ${testCases[0]?.from}, text: ${testCases[0]?.body}`);
  }
  
  const callbacks = {
    addLog: (source: any, message: string, type: any, runIndex?: number) => {
      // console.log(`[${source}] ${message}`);
    },
    setActiveNodeId: () => {},
    setTestCase: (c: any) => {
      console.log(`\n--- TEST CASE ---`);
      console.log(`From: ${c.from}`);
      console.log(`Text: ${c.body}`);
      console.log(`-----------------\n`);
    },
    isCancelled: () => false,
    delay: async () => {}
  };

  const res = await runSimulationEngine(nodes, edges, 1, "agent-loop-basic", callbacks);
  console.log("Result:", res);
}

testScenario();
