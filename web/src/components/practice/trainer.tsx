"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  useNodeConnections,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { CheckCircle2, Play, Plus, RotateCcw, X, XCircle, Maximize2, Minimize2 } from "lucide-react";
import type { EvaluationResult, PracticeBlockType, PracticeTask } from "@/types/practice";
import { cn } from "@/lib/utils";
import { SYSTEM_PROMPTS, SUBAGENT_PROMPTS } from "@/lib/simulator/prompts";
import { useGraphSimulator, type LogEntry } from "@/hooks/useGraphSimulator";



const NODE_SIZE = { width: 208, height: 96 };

const BLOCK_LABELS: Record<PracticeBlockType, string> = {
  dataInput: "Data Input (Start)",
  messageHistory: "Message History",
  systemPrompt: "System Prompt",
  subagent: "Sub-agent",
  llm: "LLM",
  toolRead: "Tool: Read",
  toolWrite: "Tool: Write",
  toolCreate: "Tool: Create",
  toolDelete: "Tool: Delete",
  condition: "Condition / Router",
  dispatcher: "Dispatcher / Sandbox",
  output: "Output / Final Answer",
};

const BLOCK_HINTS: Record<PracticeBlockType, string> = {
  dataInput: "start test",
  messageHistory: "messages",
  systemPrompt: "instructions",
  subagent: "delegate",
  llm: "reason",
  toolRead: "read data",
  toolWrite: "edit data",
  toolCreate: "new data",
  toolDelete: "remove data",
  condition: "branch",
  dispatcher: "dispatch",
  output: "final outside",
};

const BLOCK_ACCENTS: Record<PracticeBlockType, string> = {
  dataInput: "bg-indigo-500",
  messageHistory: "bg-cyan-500",
  systemPrompt: "bg-violet-500",
  subagent: "bg-purple-600",
  llm: "bg-emerald-500",
  toolRead: "bg-amber-400",
  toolWrite: "bg-amber-500",
  toolCreate: "bg-amber-600",
  toolDelete: "bg-red-500",
  condition: "bg-fuchsia-500",
  dispatcher: "bg-orange-500",
  output: "bg-rose-500",
};

const INITIAL_POSITIONS: Record<PracticeBlockType, { x: number; y: number }> = {
  dataInput: { x: 35, y: 120 },
  messageHistory: { x: 330, y: 250 },
  systemPrompt: { x: 330, y: 10 },
  subagent: { x: 330, y: 120 },
  llm: { x: 330, y: 230 },
  toolRead: { x: 650, y: 230 },
  toolWrite: { x: 650, y: 340 },
  toolCreate: { x: 650, y: 450 },
  toolDelete: { x: 650, y: 560 },
  condition: { x: 650, y: 105 },
  dispatcher: { x: 590, y: 250 },
  output: { x: 930, y: 250 },
};

type PracticeNodeData = {
  label: string;
  hint: string;
  type: PracticeBlockType;
  onDelete?: (nodeId: string) => void;
  selectedPromptId?: string;
  selectedToolId?: string;
  dispatcherTools?: string[];
  dispatcherProtectImmune?: boolean;
  onChangePrompt?: (nodeId: string, value: string) => void;
  onChangeTool?: (nodeId: string, value: string) => void;
  isActiveLoop?: boolean;
  isActiveStep?: boolean;
};

type PracticeEdgeData = {
  onDelete?: (edgeId: string) => void;
  isActiveLoop?: boolean;
};

type PracticeNode = Node<PracticeNodeData, "practiceBlock" | "conditionBlock" | "dataInputBlock">;
type PracticeEdge = Edge<PracticeEdgeData, "practiceEdge">;

function PracticeBlockNode({ id, data, selected }: NodeProps<PracticeNode>) {
  return (
    <div
      className={cn(
        "relative w-52 rounded-lg border-2 bg-white text-zinc-950 shadow-lg transition-all duration-500 dark:bg-zinc-900 dark:text-white",
        selected ? "border-blue-500" : "border-zinc-300 dark:border-zinc-600",
        data.isActiveLoop && !data.isActiveStep ? "shadow-[0_0_20px_rgba(59,130,246,0.6)] ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950" : "",
        data.isActiveStep ? "shadow-[0_0_30px_rgba(250,204,21,0.8)] border-yellow-400 ring-4 ring-yellow-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 scale-105 z-50" : ""
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
        id="top"
        position={Position.Top}
        className="!top-[-6px] !left-1/2 !-translate-x-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 opacity-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-6px] !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-blue-400"
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
        className="!right-[-6px] !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-blue-400"
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        className="!bottom-[-6px] !left-1/2 !-translate-x-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 opacity-0"
      />
    </div>
  );
}

function ConditionBlockNode({ id, data, selected }: NodeProps<PracticeNode>) {
  return (
    <div
      className={cn(
        "relative w-56 rounded-lg border-2 bg-white text-zinc-950 shadow-lg transition-all duration-500 dark:bg-zinc-900 dark:text-white",
        selected ? "border-fuchsia-500" : "border-zinc-300 dark:border-zinc-600",
        data.isActiveLoop && !data.isActiveStep ? "shadow-[0_0_20px_rgba(217,70,239,0.6)] ring-2 ring-fuchsia-400 dark:ring-fuchsia-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950" : "",
        data.isActiveStep ? "shadow-[0_0_30px_rgba(250,204,21,0.8)] border-yellow-400 ring-4 ring-yellow-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 scale-105 z-50" : ""
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
        id="top"
        position={Position.Top}
        className="!top-[-6px] !left-1/2 !-translate-x-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 opacity-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-6px] !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-fuchsia-400"
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
              className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-emerald-400"
            />
          </div>
          <div className="relative flex h-6 items-center justify-end px-3 text-red-600 dark:text-red-400">
            <span>END (False)</span>
            <Handle
              type="source"
              id="false"
              position={Position.Right}
              className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-red-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DataInputNode({ id, data, selected }: NodeProps<PracticeNode>) {
  return (
    <div
      className={cn(
        "relative w-48 rounded-lg border-2 bg-indigo-50 text-indigo-950 shadow-md transition-colors dark:bg-indigo-950/30 dark:text-indigo-100",
        selected ? "border-indigo-500" : "border-indigo-300 dark:border-indigo-800"
      )}
    >
      <button
        type="button"
        aria-label={`Удалить ${data.label}`}
        onClick={(event) => {
          event.stopPropagation();
          data.onDelete?.(id);
        }}
        className="nodrag nopan absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-indigo-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
      >
        <X size={14} />
      </button>

      <div className="flex h-[72px] items-center gap-3 px-4 py-3 pr-10">
        <span className={cn("h-9 w-1.5 rounded-full bg-indigo-500")} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{data.label}</div>
          <div className="mt-0.5 font-mono text-[11px] uppercase text-indigo-500/70 dark:text-indigo-400/70">
            {data.hint}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-indigo-200/50 px-3 py-1.5 font-mono text-[10px] text-indigo-500/70 dark:border-indigo-800/50 dark:text-indigo-400/70">
        <span>OUT</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!right-[-6px] !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-indigo-400"
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        className="!bottom-[-6px] !left-1/2 !-translate-x-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 opacity-0"
      />
    </div>
  );
}

function PracticeRouteEdge({
  id,
  sourceX: defaultSourceX,
  sourceY: defaultSourceY,
  targetX: defaultTargetX,
  targetY: defaultTargetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  data,
  source,
  target,
  sourceHandleId,
}: EdgeProps<PracticeEdge>) {
  const { getNode } = useReactFlow();
  const sourceNode = getNode(source);
  const targetNode = getNode(target);

  if (!sourceNode || !targetNode) return null;

  const sNode = sourceNode as any;
  const tNode = targetNode as any;
  const sX = sNode.positionAbsolute?.x ?? sNode.position?.x ?? 0;
  const sY = sNode.positionAbsolute?.y ?? sNode.position?.y ?? 0;
  const sW = sourceNode.measured?.width ?? sourceNode.width ?? (sourceNode.type === 'conditionBlock' ? 224 : sourceNode.type === 'dataInputBlock' ? 192 : 208);
  const sH = sourceNode.measured?.height ?? sourceNode.height ?? (sourceNode.type === 'conditionBlock' ? 96 : 85);
  
  const tX = tNode.positionAbsolute?.x ?? tNode.position?.x ?? 0;
  const tY = tNode.positionAbsolute?.y ?? tNode.position?.y ?? 0;
  const tW = targetNode.measured?.width ?? targetNode.width ?? (targetNode.type === 'conditionBlock' ? 224 : targetNode.type === 'dataInputBlock' ? 192 : 208);
  const tH = targetNode.measured?.height ?? targetNode.height ?? (targetNode.type === 'conditionBlock' ? 96 : 85);

  let startX = defaultSourceX;
  let startY = defaultSourceY;
  let startDir = Position.Right;

  if (sourcePosition !== Position.Right) {
    startX = sX + sW;
    startY = sY + sH / 2;
  }

  const isBackward = sX >= tX - 20;

  const isTargetAbove = sY > tY + tH - 20;
  const isTargetBelow = sY + sH < tY + 20;

  let endX = tX + tW / 2;
  let endY = isBackward ? tY + tH : tY;
  let endDir = isBackward ? Position.Bottom : Position.Top;

  // Dynamic vertical entry logic for cleanest paths
  if (isTargetAbove) {
    endDir = Position.Bottom;
    endY = tY + tH;
  } else if (isTargetBelow) {
    endDir = Position.Top;
    endY = tY;
  }

  // Calculate dynamic X spacing if multiple edges enter the same face
  const { getEdges } = useReactFlow();
  const edgesEnteringSameFace = getEdges().filter(e => {
    if (e.target !== targetNode.id) return false;
    const sNode: any = getNode(e.source);
    if (!sNode) return false;
    const eSX = sNode.positionAbsolute?.x ?? sNode.position?.x ?? 0;
    const eSY = sNode.positionAbsolute?.y ?? sNode.position?.y ?? 0;
    const eSH = sNode.measured?.height ?? sNode.height ?? 72;
    
    const eIsBackward = eSX >= tX - 20;
    const eIsTargetAbove = eSY > tY + tH - 20;
    const eIsTargetBelow = eSY + eSH < tY + 20;
    
    let eEndDir = eIsBackward ? Position.Bottom : Position.Top;
    if (eIsTargetAbove) eEndDir = Position.Bottom;
    else if (eIsTargetBelow) eEndDir = Position.Top;
    
    return eEndDir === endDir;
  });

  if (edgesEnteringSameFace.length > 1) {
    edgesEnteringSameFace.sort((a, b) => {
      const aNode: any = getNode(a.source);
      const bNode: any = getNode(b.source);
      const aX = aNode?.positionAbsolute?.x ?? aNode?.position?.x ?? 0;
      const bX = bNode?.positionAbsolute?.x ?? bNode?.position?.x ?? 0;
      return aX - bX;
    });

    const faceEdgeIndex = edgesEnteringSameFace.findIndex(e => e.id === id);
    if (faceEdgeIndex !== -1) {
      const spacing = 16;
      const totalWidth = (edgesEnteringSameFace.length - 1) * spacing;
      const startOffsetX = -totalWidth / 2;
      endX += startOffsetX + faceEdgeIndex * spacing;
    }
  }

  // Pull the actual edge path slightly back from the block boundary
  // so the arrowhead renders outside the block and doesn't overlap the dot
  let pathEndX = endX;
  let pathEndY = endY;
  if (endDir === Position.Top) pathEndY -= 6;
  else if (endDir === Position.Bottom) pathEndY += 6;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: startX,
    sourceY: startY,
    sourcePosition: startDir,
    targetX: pathEndX,
    targetY: pathEndY,
    targetPosition: endDir,
    borderRadius: 18,
  });

  const isLoop = data?.isActiveLoop;
  
  let targetDotColor = isLoop ? "#8b5cf6" : "#94a3b8";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isLoop ? "#8b5cf6" : (selected ? "#3b82f6" : "#94a3b8"),
          strokeWidth: 2,
          filter: isLoop ? "drop-shadow(0 0 6px rgba(139,92,246,0.6))" : "none",
          strokeDasharray: isLoop ? "8 8" : "none",
          animation: isLoop ? "dash 1.5s linear infinite" : "none",
        }}
      />
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>
      <EdgeLabelRenderer>
        <button
          type="button"
          aria-label="Удалить связь"
          onClick={(event) => {
            event.stopPropagation();
            data?.onDelete?.(id);
          }}
          className={cn(
            "nodrag nopan absolute flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow-sm transition-colors pointer-events-auto",
            isLoop ? "border-violet-400 text-violet-600 dark:bg-zinc-900 dark:text-violet-300 hover:border-red-500 hover:text-red-500" : "border-blue-200 text-blue-600 hover:border-red-300 hover:text-red-600 dark:border-blue-900 dark:bg-zinc-900 dark:text-blue-300 dark:hover:border-red-700 dark:hover:text-red-300"
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <X size={13} />
        </button>
      </EdgeLabelRenderer>

      {/* Target Dot */}
      <circle cx={endX} cy={endY} r={3} fill="#fff" stroke={targetDotColor} strokeWidth={2} className="pointer-events-none" />
    </>
  );
}

const nodeTypes = {
  practiceBlock: PracticeBlockNode,
  conditionBlock: ConditionBlockNode,
  dataInputBlock: DataInputNode,
};

const edgeTypes = {
  practiceEdge: PracticeRouteEdge,
};

const defaultEdgeOptions = {
  type: "practiceEdge",
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
};

function makeNode(type: PracticeBlockType, customId?: string): PracticeNode {
  let nodeType: any = "practiceBlock";
  if (type === "condition") nodeType = "conditionBlock";
  if (type === "dataInput") nodeType = "dataInputBlock";

  return {
    id: customId || type,
    type: nodeType,
    position: INITIAL_POSITIONS[type],
    data: { label: BLOCK_LABELS[type], hint: BLOCK_HINTS[type], type },
    draggable: true,
  };
}

function getNodeSize(type: PracticeBlockType) {
  return type === "condition" ? { width: 224, height: 122 } : NODE_SIZE;
}

function PropertiesPanel({
  selectedNode,
  onChangeData,
}: {
  selectedNode?: PracticeNode;
  onChangeData: (key: keyof PracticeNodeData, value: any) => void;
}) {
  if (!selectedNode) {
    return (
      <aside className="rounded-lg border border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
        Выберите блок на карте для настройки
      </aside>
    );
  }

  const { data } = selectedNode;

  return (
    <aside className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm overflow-y-auto max-h-full">
      <div className="mb-4 flex items-center gap-2 shrink-0">
        <span className={cn("h-4 w-1.5 rounded-full", BLOCK_ACCENTS[data.type])} />
        <h3 className="text-sm font-semibold">{data.label}</h3>
      </div>

      <div className="flex flex-col gap-4">
        {data.type === "dataInput" && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            С этого блока стартует эмуляция. Сюда будут поступать тестовые данные.
          </p>
        )}
        
        {data.type === "messageHistory" && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            История сообщений. Аккумулирует входящие сообщения и ответы модели, чтобы создать замкнутый цикл (Agent Loop).
          </p>
        )}

        {(data.type === "systemPrompt" || data.type === "subagent") && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                {data.type === "systemPrompt" ? "Системный промпт:" : "Выбор субагента:"}
              </label>
              <select
                value={data.selectedPromptId || ""}
                onChange={(e) => onChangeData("selectedPromptId", e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">-- Выберите вариант --</option>
                {(data.type === "systemPrompt" ? SYSTEM_PROMPTS : SUBAGENT_PROMPTS).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {data.selectedPromptId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Текст промпта (только чтение):
                </label>
                <textarea
                  readOnly
                  className="min-h-[140px] w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2.5 font-mono text-xs leading-relaxed text-[var(--color-text-primary)] outline-none"
                  value={(data.type === "systemPrompt" ? SYSTEM_PROMPTS : SUBAGENT_PROMPTS).find(p => p.id === data.selectedPromptId)?.text || ""}
                />
              </div>
            )}
          </>
        )}

        {data.type === "dispatcher" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                Разрешенные инструменты:
              </label>
              <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={(data.dispatcherTools || []).includes("read")}
                    onChange={(e) => {
                      const tools = data.dispatcherTools || [];
                      onChangeData("dispatcherTools", e.target.checked ? [...tools, "read"] : tools.filter(t => t !== "read"));
                    }}
                  />
                  Чтение писем (ReadEmail)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={(data.dispatcherTools || []).includes("delete")}
                    onChange={(e) => {
                      const tools = data.dispatcherTools || [];
                      onChangeData("dispatcherTools", e.target.checked ? [...tools, "delete"] : tools.filter(t => t !== "delete"));
                    }}
                  />
                  Удаление писем (DeleteEmail)
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                Политики безопасности (Запреты):
              </label>
              <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="mt-1"
                    checked={data.dispatcherProtectImmune || false}
                    onChange={(e) => onChangeData("dispatcherProtectImmune", e.target.checked)}
                  />
                  <span className="leading-tight text-xs">Заблокировать удаление писем от адресов с "иммунитетом" (например, от руководства)</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function LogsPanel({ logs, isRunning }: { logs: LogEntry[]; isRunning: boolean }) {
  return (
    <aside className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm overflow-hidden h-full">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4 shrink-0 bg-[var(--color-bg-secondary)]">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {isRunning && <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
          </span>}
          Логи выполнения
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {logs.length === 0 && <p className="text-[var(--color-text-secondary)] text-center mt-4">Ожидание запуска...</p>}
        {logs.map((log) => (
          <div 
            key={log.id} 
            className={cn(
              "p-2.5 rounded border leading-relaxed",
              log.type === "error" ? "bg-red-50/50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400" :
              log.type === "success" ? "bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400" :
              log.type === "warning" ? "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400" :
              "bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold opacity-70 uppercase tracking-wider text-[9px]">[{log.source}]</span>
              <span className="opacity-40 ml-auto">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit', hour: '2-digit' })}</span>
            </div>
            {log.message}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function PracticeTrainer({ task }: { task: PracticeTask }) {
  const storageKey = useMemo(() => `practice_flow_state_${task.id}`, [task.id]);

  const initialNodes = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.nodes && parsed.nodes.length > 0) return parsed.nodes;
        }
      } catch (e) {
        console.error("Failed to restore nodes:", e);
      }
    }
    return task.blocks.slice(0, 3).map(b => makeNode(b));
  }, [storageKey, task.blocks]);

  const [nodes, setNodes, onNodesChange] = useNodesState<PracticeNode>(initialNodes);

  const initialEdges = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.edges) return parsed.edges;
        }
      } catch (e) {
        console.error("Failed to restore edges:", e);
      }
    }
    return [];
  }, [storageKey]);

  const [edges, setEdges, onEdgesChange] = useEdgesState<PracticeEdge>(initialEdges);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify({ nodes, edges }));
    }
  }, [nodes, edges, storageKey]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { isRunning, activeNodeId, logs, runSimulation, stopSimulation } = useGraphSimulator();

  const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);

  const existingTypes = new Set(nodes.map((node) => node.data.type));

  const { loopEdges, loopNodes } = useMemo(() => {
    const mhNodes = nodes.filter(n => n.data.type === "messageHistory").map(n => n.id);
    const lEdges = new Set<string>();
    const lNodes = new Set<string>();
    
    for (const mhId of mhNodes) {
      const visited = new Set<string>();
      const stack: { nodeId: string, edgePath: string[], nodePath: string[] }[] = [{ nodeId: mhId, edgePath: [], nodePath: [mhId] }];
      
      while (stack.length > 0) {
        const { nodeId, edgePath, nodePath } = stack.pop()!;
        if (visited.has(nodeId)) {
          if (nodeId === mhId && edgePath.length > 0) {
            edgePath.forEach(id => lEdges.add(id));
            nodePath.forEach(id => lNodes.add(id));
          }
          continue;
        }
        visited.add(nodeId);
        const outgoing = edges.filter(e => e.source === nodeId);
        for (const edge of outgoing) {
          stack.push({ nodeId: edge.target, edgePath: [...edgePath, edge.id], nodePath: [...nodePath, edge.target] });
        }
      }
    }
    return { loopEdges: lEdges, loopNodes: lNodes };
  }, [nodes, edges]);

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
        data: {
          ...node.data,
          onDelete: deleteNode,
          isActiveLoop: loopNodes.has(node.id),
          isActiveStep: node.id === activeNodeId,
        },
      })),
    [deleteNode, nodes, loopNodes, activeNodeId]
  );

  const visibleEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: { ...edge.data, onDelete: deleteEdge, isActiveLoop: loopEdges.has(edge.id) },
      })),
    [deleteEdge, edges, loopEdges]
  );

  function addBlock(type: PracticeBlockType) {
    setNodes((current) => {
      if (type !== "messageHistory" && current.some((node) => node.data.type === type)) {
        return current;
      }
      
      const customId = type === "messageHistory" 
        ? `${type}-${Math.random().toString(36).substr(2, 9)}` 
        : type;
        
      return [...current, makeNode(type, customId)];
    });
    setEvaluation(null);
  }

  function resetGraph() {
    setNodes(initialNodes);
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
    if (isRunning) {
      stopSimulation();
      return;
    }
    await runSimulation(nodes, edges);
  }

  return (
    <div className={cn(
      "grid gap-4 bg-[var(--color-bg)] transition-all",
      isFullscreen 
        ? "fixed inset-0 z-[100] p-4 lg:grid-cols-[200px_minmax(0,1fr)_280px] h-screen" 
        : "lg:grid-cols-[200px_minmax(0,1fr)_280px]"
    )}>
      <aside className="flex flex-col overflow-y-auto rounded-lg border border-[var(--color-border)] p-3 max-h-full">
        <div className="mb-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)] shrink-0">
          Блоки
        </div>
        <div className="flex flex-col gap-2">
          {task.blocks.map((block) => {
            const exists = existingTypes.has(block);
            if (exists && block !== "messageHistory") return null;
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

        <div className="mt-5 shrink-0 border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--color-text-secondary)]">
          Используйте Condition (Router), чтобы создать узел с ветвлением (например, есть вызов инструментов или нет) и соедините конец цепочки с LLM, чтобы создать цикл.
        </div>
      </aside>

      <section className="min-w-0 flex flex-col max-h-full">
        <div className="mb-3 shrink-0 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
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
              className={cn(
                "inline-flex min-h-[40px] items-center gap-2 rounded-md px-4 text-sm font-medium text-white transition-colors",
                isRunning 
                  ? "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700" 
                  : "bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              )}
            >
              {isRunning ? <X size={16} /> : <Play size={16} />}
              {isRunning ? "Остановить" : "Запустить"}
            </button>
          </div>
        </div>

        <div className={cn(
          "overflow-hidden rounded-lg border border-[var(--color-border)] bg-zinc-50 dark:bg-zinc-950 relative",
          isFullscreen ? "flex-1 min-h-[400px]" : "h-[620px]"
        )}>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-white text-zinc-500 shadow-sm border border-zinc-200 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label={isFullscreen ? "Свернуть" : "На весь экран"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
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
            connectionRadius={60}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background color="#334155" gap={18} size={1.2} />
            <Controls />
          </ReactFlow>
        </div>

        {evaluation && (
          <div className="mt-4 shrink-0 rounded-lg border border-[var(--color-border)] p-4">
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

      {(isRunning || logs.length > 0) ? (
        <LogsPanel logs={logs} isRunning={isRunning} />
      ) : (
        <PropertiesPanel
          selectedNode={selectedNode}
          onChangeData={(key, value) => {
            if (selectedNode) {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n
                )
              );
            }
          }}
        />
      )}
    </div>
  );
}
