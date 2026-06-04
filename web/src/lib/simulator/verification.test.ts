import { analyzeGraphVulnerabilities, generateTargetedTestCases, runSimulationEngine } from "./engine";
import { TASK_REQUIREMENTS } from "./taskRequirements";

describe("Matrix Testing: Vulnerability Analysis & Attack Generation", () => {
  // Utility function to create a perfect graph for a given set of required protections
  const createPerfectGraph = (protectedEmails: string[]) => ({
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: protectedEmails } },
      { id: "n7", data: { type: "output" } }
    ],
    edges: []
  });

  const getExpectedFrom = (handle: string) => {
    if (handle.includes("ceo")) return "ceo@company.com";
    if (handle.includes("alex")) return "alex.manager@company.com";
    if (handle.includes("billing")) return "billing@aws.amazon.com";
    if (handle.includes("sarah")) return "sarah.dev@company.com";
    return handle;
  };

  // Find the requirements for task-5 (task-5)
  const taskReq = TASK_REQUIREMENTS.find(t => t.taskId === "task-5");

  if (taskReq && taskReq.requiredProtectedEmails.length > 0) {
    describe(`Task: ${taskReq.taskId} - Matrix Combinations`, () => {
      const allProtected = taskReq.requiredProtectedEmails;

      // MATRIX TEST: Each required contact left unprotected one by one
      test.each(allProtected)(
        "Should perfectly target %s when it is the ONLY unprotected contact",
        (unprotectedContact) => {
          // Mutate graph: exclude exactly one required contact
          const graphProtected = allProtected.filter(c => c !== unprotectedContact);
          const graph = createPerfectGraph(graphProtected);

          // Phase 1: Engine Analysis
          const vulns = analyzeGraphVulnerabilities(graph.nodes, graph.edges, taskReq.taskId);
          
          expect(vulns.length).toBe(1);
          expect(vulns[0]).toEqual({ type: "unprotected_sender", sender: unprotectedContact });

          // Phase 2: Attack Generation (simulate 1 run)
          const testCases = generateTargetedTestCases(1, vulns);
          expect(testCases.length).toBe(1);
          
          const expectedFrom = getExpectedFrom(unprotectedContact);
          expect(testCases[0].from).toBe(expectedFrom);
          expect(testCases[0].forceHallucination).toBe(true);
        }
      );

      // MATRIX TEST: All contacts missing
      test("Should cycle through targets when MULTIPLE contacts are unprotected", () => {
        // Mutate graph: No dispatcher protections!
        const graph = createPerfectGraph([]);
        const vulns = analyzeGraphVulnerabilities(graph.nodes, graph.edges, taskReq.taskId);
        
        expect(vulns.length).toBe(allProtected.length); // All are unprotected

        // If we generate runsCount = vulnerabilities count, it should hit all of them
        const testCases = generateTargetedTestCases(allProtected.length, vulns);
        expect(testCases.length).toBe(allProtected.length);

        const targetedSenders = testCases.map(tc => tc.from);
        
        allProtected.forEach(contact => {
          const expectedFrom = getExpectedFrom(contact);
          expect(targetedSenders).toContain(expectedFrom);
        });
      });

      // MATRIX TEST: Missing Tools
      test("Should target missing_delete_tool vulnerability when delete is missing", () => {
        const graph = createPerfectGraph(allProtected);
        // Mutate: Remove delete tool
        graph.nodes.find(n => n.data.type === "systemPrompt")!.data.systemPromptTools = ["read"];
        graph.nodes.find(n => n.data.type === "dispatcher")!.data.dispatcherTools = ["read"];

        const vulns = analyzeGraphVulnerabilities(graph.nodes, graph.edges, taskReq.taskId);
        expect(vulns).toContainEqual({ type: "missing_delete_tool" });

        const testCases = generateTargetedTestCases(1, vulns);
        expect(testCases[0].isSpam).toBe(true); // Should send a spam attack since we can't delete
      });

      test("Should fail simulation run if a tool node is executed but not enabled in System Prompt", async () => {
        const graph = {
          nodes: [
            { id: "n1", data: { type: "dataInput" } },
            { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: [] } }, // Disabled!
            { id: "n3", data: { type: "toolRead" } },
            { id: "n4", data: { type: "output" } }
          ],
          edges: [
            { source: "n1", target: "n3" },
            { source: "n3", target: "n4" }
          ]
        };

        const logs: string[] = [];
        const callbacks = {
          addLog: (source: any, message: string, type: any) => {
            logs.push(message);
          },
          setActiveNodeId: () => {},
          setTestCase: () => {},
          isCancelled: () => false,
        };

        const res = await runSimulationEngine(graph.nodes, graph.edges, 1, "task-5", callbacks);
        expect(res.passedRuns).toBe(0);
        expect(logs.some(l => l.includes("вызван, но он не был включен в блоке System Prompt!"))).toBe(true);
      });
    });
  }
});
