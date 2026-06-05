import { runSimulationEngine, analyzeGraphVulnerabilities } from "../src/lib/simulator/engine";
import { REGRESSION_TESTS } from "../src/lib/simulator/verification";

async function main() {
  const test = REGRESSION_TESTS.find(t => t.id === "task-5-missing-delete-tool");
  if (!test) return;
  const vulns = analyzeGraphVulnerabilities(test.nodes, test.edges, test.taskId);
  console.log("Found vulns:", vulns);
}
main();
