"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  addEdge,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { CheckCircle2, Play, Plus, RotateCcw, X, XCircle } from "lucide-react";
import type { EvaluationResult, PracticeBlockType, PracticeTask } from "@/types/practice";
import { cn } from "@/lib/utils";

const NODE_SIZE = { width: 208, height: 96 };

const BLOCK_LABELS: Record<PracticeBlockType, string> = {
  systemPrompt: "System Prompt",
  llm: "LLM",
  tools: "Tools",
  skills: "Skills",
  memory: "Memory",
  condition: "Condition / Router",
  dispatcher: "Dispatcher / Sandbox",
  output: "Output / Final Answer",
};

const BLOCK_HINTS: Record<PracticeBlockType, string> = {
  systemPrompt: "rules",
  llm: "reason",
  tools: "outside call",
  skills: "load",
  memory: "state",
  condition: "branch",
  dispatcher: "dispatch",
  output: "final outside",
};

const BLOCK_ACCENTS: Record<PracticeBlockType, string> = {
  systemPrompt: "bg-sky-500",
  llm: "bg-emerald-500",
  tools: "bg-amber-500",
  skills: "bg-violet-500",
  memory: "bg-cyan-500",
  condition: "bg-fuchsia-500",
  dispatcher: "bg-orange-500",
  output: "bg-rose-500",
};

const INITIAL_POSITIONS: Record<PracticeBlockType, { x: number; y: number }> = {
  systemPrompt: { x: 35, y: 120 },
  memory: { x: 330, y: 250 },
  llm: { x: 330, y: 105 },
  condition: { x: 650, y: 105 },
  dispatcher: { x: 590, y: 250 },
  skills: { x: 650, y: 250 },
  tools: { x: 930, y: 105 },
  output: { x: 930, y: 250 },
};

type PracticeNodeData = {
  label: string;
  hint: string;
  type: PracticeBlockType;
  onDelete?: (nodeId: string) => void;
};

type PracticeEdgeData = {
  onDelete?: (edgeId: string) => void;
};

type PracticeNode = Node<PracticeNodeData, "practiceBlock" | "conditionBlock">;
type PracticeEdge = Edge<PracticeEdgeData, "practiceEdge">;

function PracticeBlockNode({ id, data, selected }: NodeProps<PracticeNode>) {
  return (
    <div
      className={cn(
        "relative w-52 rounded-lg border-2 bg-white text-zinc-950 shadow-lg transition-colors dark:bg-zinc-900 dark:text-white",
        selected ? "border-blue-500" : "border-zinc-300 dark:border-zinc-600"
      )}
    >
      <button
        type="button"
        aria-label={`Удалить ${data.label}`}
        onClick={(event) => {
          event.stopPropagation();
          data.onDelete?.(id);
        }}
        className="nodrag nopan absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
      >
        <X size={14} />
      </button>

      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-9px] !h-5 !w-5 !border-2 !border-white !bg-blue-500 dark:!border-zinc-900"
      />

      <div className="flex h-[72px] items-center gap-3 px-4 py-3 pr-10">
        <span className={cn("h-9 w-1.5 rounded-full", BLOCK_ACCENTS[data.type])} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{data.label}</div>
          <div className="mt-0.5 font-mono text-[11px] uppercase text-zinc-500 dark:text-zinc-400">
            {data.hint}
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t border-zinc-200 px-3 py-1.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <span>IN</span>
        <span>OUT</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!right-[-9px] !h-5 !w-5 !border-2 !border-white !bg-blue-500 dark:!border-zinc-900"
      />
    </div>
  );
}

function ConditionBlockNode({ id, data, selected }: NodeProps<PracticeNode>) {
  return (
    <div
      className={cn(
        "relative w-56 rounded-lg border-2 bg-white text-zinc-950 shadow-lg transition-colors dark:bg-zinc-900 dark:text-white",
        selected ? "border-fuchsia-500" : "border-zinc-300 dark:border-zinc-600"
      )}
    >
      <button
        type="button"
        aria-label={`Удалить ${data.label}`}
        onClick={(event) => {
          event.stopPropagation();
          data.onDelete?.(id);
        }}
        className="nodrag nopan absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
      >
        <X size={14} />
      </button>

      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-9px] !h-5 !w-5 !border-2 !border-white !bg-fuchsia-500 dark:!border-zinc-900"
      />

      <div className="flex h-[72px] items-center gap-3 px-4 py-3 pr-10">
        <span className={cn("h-9 w-1.5 rounded-full", BLOCK_ACCENTS[data.type])} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{data.label}</div>
          <div className="mt-0.5 font-mono text-[11px] uppercase text-zinc-500 dark:text-zinc-400">
            {data.hint}
          </div>
        </div>
      </div>

      <div className="flex border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-md">
        <div className="flex items-center justify-center border-r border-zinc-200 px-3 py-2 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          IN
        </div>
        <div className="flex flex-1 flex-col py-1 font-mono text-[10px] font-medium">
          <div className="relative flex h-6 items-center justify-end px-3 text-emerald-600 dark:text-emerald-400">
            <span>TOOLS (True)</span>
            <Handle
              type="source"
              id="true"
              position={Position.Right}
              className="!right-[-9px] !top-[14px] !h-4 !w-4 !border-2 !border-white !bg-emerald-500 dark:!border-zinc-900"
            />
          </div>
          <div className="relative flex h-6 items-center justify-end px-3 text-red-600 dark:text-red-400">
            <span>END (False)</span>
            <Handle
              type="source"
              id="false"
              position={Position.Right}
              className="!right-[-9px] !top-[38px] !h-4 !w-4 !border-2 !border-white !bg-red-500 dark:!border-zinc-900"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PracticeRouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  data,
}: EdgeProps<PracticeEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "#60a5fa" : "#3b82f6",
          strokeWidth: selected ? 5 : 4,
          filter: "drop-shadow(0 1px 2px rgba(37, 99, 235, 0.35))",
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          aria-label="Удалить связь"
          onClick={(event) => {
            event.stopPropagation();
            data?.onDelete?.(id);
          }}
          className="nodrag nopan absolute flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 shadow-sm transition-colors hover:border-red-300 hover:text-red-600 dark:border-blue-900 dark:bg-zinc-900 dark:text-blue-300 dark:hover:border-red-700 dark:hover:text-red-300"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <X size={13} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  practiceBlock: PracticeBlockNode,
  conditionBlock: ConditionBlockNode,
};

const edgeTypes = {
  practiceEdge: PracticeRouteEdge,
};

const defaultEdgeOptions = {
  type: "practiceEdge",
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
};

function makeNode(type: PracticeBlockType): PracticeNode {
  return {
    id: type,
    type: type === "condition" ? "conditionBlock" : "practiceBlock",
    position: INITIAL_POSITIONS[type],
    data: { label: BLOCK_LABELS[type], hint: BLOCK_HINTS[type], type },
    draggable: true,
  };
}

function getNodeSize(type: PracticeBlockType) {
  return type === "condition" ? { width: 224, height: 122 } : NODE_SIZE;
}

export function PracticeTrainer({ task }: { task: PracticeTask }) {
  const starterNodes = useMemo(() => task.blocks.slice(0, 3).map(makeNode), [task.blocks]);
  const [nodes, setNodes, onNodesChange] = useNodesState<PracticeNode>(starterNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PracticeEdge>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const existingTypes = new Set(nodes.map((node) => node.data.type));

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
      setEvaluation(null);
    },
    [setEdges]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      setEvaluation(null);
    },
    [setEdges, setNodes]
  );

  const visibleNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: { ...node.data, onDelete: deleteNode },
      })),
    [deleteNode, nodes]
  );

  const visibleEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: { ...edge.data, onDelete: deleteEdge },
      })),
    [deleteEdge, edges]
  );

  function addBlock(type: PracticeBlockType) {
    setNodes((current) => {
      if (current.some((node) => node.data.type === type)) return current;
      return [...current, makeNode(type)];
    });
    setEvaluation(null);
  }

  function resetGraph() {
    setNodes(starterNodes);
    setEdges([]);
    setEvaluation(null);
  }

  function onConnect(connection: Connection) {
    setEdges((current) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return current;
      }
      if (
        current.some(
          (edge) => edge.source === connection.source && edge.target === connection.target
        )
      ) {
        return current;
      }
      return addEdge(
        {
          ...connection,
          id: `${connection.source}->${connection.target}`,
          type: "practiceEdge",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        },
        current
      );
    });
    setEvaluation(null);
  }

  async function run() {
    setLoading(true);
    setEvaluation(null);
    const response = await fetch("/api/practice/evaluate/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        graph: {
          nodes: nodes.map((node) => ({
            id: node.id,
            type: node.data.type,
            position: node.position,
            size: getNodeSize(node.data.type),
          })),
          edges: edges.map((edge) => ({ source: edge.source, target: edge.target })),
        },
      }),
    });
    const payload = (await response.json()) as { evaluation?: EvaluationResult; reason?: string };
    setLoading(false);
    setEvaluation(
      payload.evaluation ?? {
        passed: false,
        score: 0,
        result: "request_failed",
        feedback: [payload.reason ?? "Симулятор не смог проверить граф."],
      }
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-[var(--color-border)] p-3">
        <div className="mb-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
          Блоки
        </div>
        <div className="flex flex-col gap-2">
          {task.blocks.map((block) => {
            const exists = existingTypes.has(block);
            if (exists) return null;
            return (
              <button
                key={block}
                onClick={() => addBlock(block)}
                className="flex min-h-[40px] items-center justify-between rounded-md border border-[var(--color-border)] px-3 text-left text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                {BLOCK_LABELS[block]}
                <Plus size={14} />
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--color-text-secondary)]">
          Используйте Condition (Router), чтобы создать узел с ветвлением (например, есть вызов инструментов или нет) и соедините конец цепочки с LLM, чтобы создать цикл.
        </div>
      </aside>

      <section className="min-w-0">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{task.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">
              {task.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={resetGraph}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[var(--color-border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              <RotateCcw size={16} />
              Сбросить
            </button>
            <button
              onClick={run}
              disabled={loading}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Play size={16} />
              {loading ? "Запуск..." : "Запустить"}
            </button>
          </div>
        </div>

        <div className="h-[620px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-zinc-50 dark:bg-zinc-950">
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background color="#334155" gap={18} size={1.2} />
            <Controls />
          </ReactFlow>
        </div>

        {evaluation && (
          <div className="mt-4 rounded-lg border border-[var(--color-border)] p-4">
            <div className="flex items-center gap-2">
              {evaluation.passed ? (
                <CheckCircle2 className="text-emerald-500" size={18} />
              ) : (
                <XCircle className="text-red-500" size={18} />
              )}
              <h2 className="font-semibold">
                {evaluation.passed ? "Задача пройдена" : "Нужно поправить граф"}
              </h2>
              <span className="ml-auto text-sm text-[var(--color-text-secondary)]">
                {evaluation.score} / {task.score}
              </span>
            </div>
            <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Результат симуляции: <span className="font-mono">{evaluation.result}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {evaluation.feedback.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
