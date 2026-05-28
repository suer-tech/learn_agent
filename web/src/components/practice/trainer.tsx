"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  Panel,
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
  type ReactFlowInstance,
} from "@xyflow/react";
import { CheckCircle2, Play, Plus, RotateCcw, X, XCircle, Maximize2, Minimize2, ChevronDown, ChevronRight } from "lucide-react";
import type { EvaluationResult, PracticeBlockType, PracticeTask } from "@/types/practice";
import { cn } from "@/lib/utils";
import { SYSTEM_PROMPTS, SUBAGENT_PROMPTS } from "@/lib/simulator/prompts";
import { useGraphSimulator, type LogEntry } from "@/hooks/useGraphSimulator";
import { EMAIL_TEST_CASES } from "@/lib/simulator/emails";



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
  toolBash: "Tool: Bash",
  toolSearch: "Tool: Search",
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
  toolWrite: "Обновление",
  toolCreate: "Создание",
  toolDelete: "Удаление",
  toolBash: "Терминал",
  toolSearch: "Поиск файлов",
  condition: "branch",
  dispatcher: "Доступ к API",
  output: "final outside",
};

const BLOCK_ACCENTS: Record<PracticeBlockType, string> = {
  dataInput: "bg-indigo-500",
  messageHistory: "bg-cyan-500",
  systemPrompt: "bg-violet-500",
  subagent: "bg-purple-600",
  llm: "bg-emerald-500",
  toolRead: "bg-amber-400",
  toolWrite: "bg-emerald-500",
  toolCreate: "bg-blue-500",
  toolDelete: "bg-red-500",
  toolBash: "bg-zinc-800 dark:bg-zinc-300",
  toolSearch: "bg-teal-500",
  condition: "bg-fuchsia-500",
  dispatcher: "bg-cyan-500",
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
  toolDelete: { x: 800, y: 150 },
  condition: { x: 650, y: 105 },
  dispatcher: { x: 590, y: 250 },
  output: { x: 930, y: 250 },
  toolBash: { x: 650, y: 350 },
  toolSearch: { x: 650, y: 150 },
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
  dispatcherProtectedEmails?: string[];
  systemPromptTools?: string[];
  onChangePrompt?: (nodeId: string, value: string) => void;
  onChangeTool?: (nodeId: string, value: string) => void;
  isActiveLoop?: boolean;
  isActiveStep?: boolean;
  conditionMode?: "true_false" | "tool_select" | "file_tools";
  selectedLlm?: "model_1" | "model_2";
  isGhost?: boolean;
  isTutorialSource?: boolean;
  isTutorialTarget?: boolean;
  isErrorHighlight?: boolean;
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
        data.isActiveStep ? "shadow-[0_0_30px_rgba(250,204,21,0.8)] border-yellow-400 ring-4 ring-yellow-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 scale-105 z-50" : "",
        data.isGhost ? "border-dashed border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/40 pointer-events-none z-0 animate-[ghostPulse_2s_ease-in-out_infinite]" : "",
        data.isErrorHighlight ? "shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-500 ring-2 ring-red-400 dark:ring-red-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 animate-pulse z-40" : ""
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
        className="!top-[-6px] !left-1/2 !-ml-[-5px] !h-2.5 !w-2.5 !rounded-full !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900"
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
        {data.type !== "output" && <span>OUT</span>}
      </div>

      {data.type !== "output" && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            className={cn(
              "!right-[-6px] !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-blue-400",
              data.isTutorialSource && "!h-5 !w-5 !bg-blue-500 !border-blue-300 ring-4 ring-blue-500/50 animate-pulse !right-[-10px] z-10"
            )}
          />
          <Handle
            type="source"
            id="bottom"
            position={Position.Bottom}
            className="!bottom-[-6px] !left-1/2 !-translate-x-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 opacity-0"
          />
        </>
      )}
      {data.isErrorHighlight && (
        <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-xl shadow-red-500/40 ring-1 ring-white/20 z-50">
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-red-500" />
          Настройте системный промпт
        </div>
      )}
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
        className="!top-[-6px] !left-1/2 !-ml-[-5px] !h-2.5 !w-2.5 !rounded-full !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900"
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
          {data.conditionMode === "tool_select" ? (
            <>
              <div className="relative flex h-6 items-center justify-end px-3 text-cyan-600 dark:text-cyan-400">
                <span>READ</span>
                <Handle
                  type="source"
                  id="read"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-cyan-400"
                />
              </div>
              <div className="relative flex h-6 items-center justify-end px-3 text-red-600 dark:text-red-400">
                <span>DELETE</span>
                <Handle
                  type="source"
                  id="delete"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-red-400"
                />
              </div>
              <div className="relative flex h-6 items-center justify-end px-3 text-blue-600 dark:text-blue-400">
                <span>WRITE</span>
                <Handle
                  type="source"
                  id="write"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-blue-400"
                />
              </div>
              <div className="relative flex h-6 items-center justify-end px-3 text-emerald-600 dark:text-emerald-400">
                <span>CREATE</span>
                <Handle
                  type="source"
                  id="create"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-emerald-400"
                />
              </div>
              <div className="relative flex h-6 items-center justify-end px-3 text-orange-600 dark:text-orange-400">
                <span>EXIT (False)</span>
                <Handle
                  type="source"
                  id="false"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-orange-400"
                />
              </div>
            </>
          ) : data.conditionMode === "file_tools" ? (
            <>
              <div className="relative flex h-6 items-center justify-end px-3 text-purple-600 dark:text-purple-400">
                <span>SEARCH/BASH</span>
                <Handle
                  type="source"
                  id="search_bash"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-purple-400"
                />
              </div>
              <div className="relative flex h-6 items-center justify-end px-3 text-emerald-600 dark:text-emerald-400">
                <span>CREATE</span>
                <Handle
                  type="source"
                  id="create"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-emerald-400"
                />
              </div>
              <div className="relative flex h-6 items-center justify-end px-3 text-orange-600 dark:text-orange-400">
                <span>EXIT (False)</span>
                <Handle
                  type="source"
                  id="false"
                  position={Position.Right}
                  className="!right-[-6px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-orange-400"
                />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
        className={cn(
          "!right-[-6px] !h-3 !w-3 !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900 transition-colors hover:!border-indigo-400",
          data.isTutorialSource && "!h-5 !w-5 !bg-blue-500 !border-blue-300 ring-4 ring-blue-500/50 animate-pulse !right-[-10px] z-10"
        )}
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
  nodes,
  onChangeData,
  task,
  showSysPromptError,
}: {
  selectedNode?: PracticeNode;
  nodes: PracticeNode[];
  onChangeData: (key: keyof PracticeNodeData, value: any) => void;
  task: PracticeTask;
  showSysPromptError?: boolean;
}) {
  if (!selectedNode) {
    return (
      <aside className="rounded-lg border border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
        Выберите блок на карте для настройки
      </aside>
    );
  }

  const { data } = selectedNode;

  // Автовыбор промпта если доступен только один вариант
  const availablePrompts = data.type === "systemPrompt"
    ? (task.id === "tutorial-task" ? SYSTEM_PROMPTS.filter(p => p.id === "sp_tutorial") :
       task.id === "task-2" ? SYSTEM_PROMPTS.filter(p => p.id === "sp_task2") :
       task.id === "task-3-files" ? SYSTEM_PROMPTS.filter(p => p.id === "sp_task3_files") :
       SYSTEM_PROMPTS.filter(p => p.id !== "sp_tutorial" && p.id !== "sp_task2" && p.id !== "sp_task3_files"))
    : [];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (
      data.type === "systemPrompt" &&
      availablePrompts.length === 1 &&
      data.selectedPromptId !== availablePrompts[0].id
    ) {
      onChangeData("selectedPromptId", availablePrompts[0].id);
    }
  }, [selectedNode.id, availablePrompts.length]);

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
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            История сообщений. Аккумулирует входящие сообщения и ответы модели.
          </p>
        )}
        
        {data.type === "llm" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Модель искусственного интеллекта. Анализирует историю сообщений и принимает решения.
            </p>
            {task.id !== "tutorial-task" && task.id !== "task-2" && (
              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Выберите модель LLM:</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name={`llmModel-${selectedNode.id}`}
                    checked={!data.selectedLlm || data.selectedLlm === "model_1"}
                    onChange={() => onChangeData("selectedLlm", "model_1")}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--color-text)]">Модель 1 (Spam-Focused)</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight">Хорошо выявляет спам, но имеет 20% шанс галлюцинации (удаление легитимных писем).</span>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name={`llmModel-${selectedNode.id}`}
                    checked={data.selectedLlm === "model_2"}
                    onChange={() => onChangeData("selectedLlm", "model_2")}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--color-text)]">Модель 2 (Invoice-Focused)</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight">Лучше определяет счета, но имеет 30% шанс галлюцинации (удаление легитимных писем).</span>
                  </div>
                </label>
              </div>
            </div>
            )}
          </div>
        )}

        {data.type === "condition" && task.id !== "tutorial-task" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              Блок развилки. Позволяет перенаправлять выполнение агента по разным веткам в зависимости от режима работы.
            </p>
            {task.id !== "task-2" ? (
              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Режим работы развилки:</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name={`conditionMode-${selectedNode.id}`}
                    checked={!data.conditionMode || data.conditionMode === "true_false"}
                    onChange={() => onChangeData("conditionMode", "true_false")}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Проверка наличия команды</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">Два пути: Tools (есть команда) или End (выход).</span>
                  </div>
                </label>
                {task.id !== "task-3-files" && (
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name={`conditionMode-${selectedNode.id}`}
                      checked={data.conditionMode === "tool_select"}
                      onChange={() => onChangeData("conditionMode", "tool_select")}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">Выбор инструмента</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">Пять путей: по одному для каждого инструмента (Read, Delete, Write, Create) + Exit.</span>
                    </div>
                  </label>
                )}
                {task.id === "task-3-files" && (
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name={`conditionMode-${selectedNode.id}`}
                      checked={data.conditionMode === "file_tools"}
                      onChange={() => onChangeData("conditionMode", "file_tools")}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">Выбор инструмента (Файлы)</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">Три пути: Search/Bash, Create, Exit.</span>
                    </div>
                  </label>
                )}
              </div>
            </div>
            ) : (
              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs font-medium">Текущий режим: Проверка наличия команды</span>
                <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight">Два пути: Tools (есть команда) или End (выход).</span>
              </div>
            )}
          </div>
        )}

        {data.type === "output" && (
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Конечная точка выполнения. Завершает работу агента и возвращает итоговый ответ (Final Answer) обратно пользователю.
          </p>
        )}

        {data.type.startsWith("tool") && (
          <div className="flex flex-col gap-2">
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {data.type === "toolRead" && "Инструмент для чтения данных. Позволяет агенту получать информацию из внешних источников (например, чтение писем или запросы к API)."}
              {data.type === "toolWrite" && "Инструмент для изменения данных. Позволяет агенту обновлять существующие записи (например, помечать письма прочитанными)."}
              {data.type === "toolCreate" && "Инструмент для создания данных. Позволяет агенту добавлять новые записи (например, отправка новых писем)."}
              {data.type === "toolDelete" && "Инструмент для удаления данных. Позволяет агенту необратимо удалять информацию (например, удаление спама)."}
              {data.type === "toolBash" && "Инструмент Bash. Позволяет агенту выполнять системные команды (например, ls, cat, grep)."}
            </p>
          </div>
        )}

        {(data.type === "systemPrompt" || data.type === "subagent") && (
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {data.type === "systemPrompt" ? "Выберите вариант системного промпта:" : "Выберите вариант субагента:"}
            </label>
            <div className="flex flex-col gap-2">
              {(data.type === "systemPrompt" ? 
                (task.id === "tutorial-task" ? SYSTEM_PROMPTS.filter(p => p.id === "sp_tutorial") : 
                 task.id === "task-2" ? SYSTEM_PROMPTS.filter(p => p.id === "sp_task2") :
                 task.id === "task-3-files" ? SYSTEM_PROMPTS.filter(p => p.id === "sp_task3_files") :
                 SYSTEM_PROMPTS.filter(p => p.id !== "sp_tutorial" && p.id !== "sp_task2" && p.id !== "sp_task3_files"))
                : SUBAGENT_PROMPTS).map(p => (
                <div
                  key={p.id}
                  onClick={() => onChangeData("selectedPromptId", p.id)}
                  className={cn(
                    "cursor-pointer rounded-md border p-2.5 transition-all text-left",
                    data.selectedPromptId === p.id 
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500 shadow-sm" 
                      : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-zinc-400 dark:hover:border-zinc-500 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="font-mono text-[10px] sm:text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-primary)] p-2 rounded border border-[var(--color-border)] max-h-48 overflow-y-auto">
                    {p.text}
                  </div>
                </div>
              ))}
            </div>

            {data.type === "systemPrompt" && task.id !== "tutorial-task" && (
              <div className="flex flex-col gap-3 pt-3 border-t border-[var(--color-border)] mt-2 relative">
                {showSysPromptError && selectedNode?.id === nodes.find(n => n.data.type === "systemPrompt")?.id && (
                  <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-xl shadow-blue-500/40 ring-1 ring-white/20 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] mb-1">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      {task.id === "task-3-files" 
                        ? "Включите инструменты Create и Search/Bash для работы с файлами"
                        : "Включите инструмент Bash, чтобы агент мог его использовать"}
                    </div>
                  </div>
                )}
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Инструменты для промпта (Контекст):
                </label>
                <div className="text-xs text-[var(--color-text-secondary)] mb-1 leading-relaxed">
                  Выберите, какие инструменты будут описаны в системном промпте агента. Доступны те, что добавлены на карту или разрешены в блоке Dispatcher.
                </div>
                {(() => {
                  const dispatcherNode = nodes.find(n => n.data.type === "dispatcher");
                  const hasDispRead = !!dispatcherNode?.data.dispatcherTools?.includes("read");
                  const hasDispDelete = !!dispatcherNode?.data.dispatcherTools?.includes("delete");
                  const hasToolRead = nodes.some(n => n.data.type === "toolRead");
                  const hasToolWrite = nodes.some(n => n.data.type === "toolWrite");
                  const hasToolCreate = nodes.some(n => n.data.type === "toolCreate");
                  const hasToolDelete = nodes.some(n => n.data.type === "toolDelete");
                  const hasToolBash = nodes.some(n => n.data.type === "toolBash");
                  const hasToolSearch = nodes.some(n => n.data.type === "toolSearch");

                  const ALL_TOOLS = task.id === "task-2" ? [
                    { id: "bash_node", label: "Tool: Bash", available: hasToolBash },
                  ] : task.id === "task-3-files" ? [
                    { id: "bash_node", label: "Tool: Bash", available: hasToolBash },
                    { id: "search_node", label: "Tool: Search", available: hasToolSearch },
                    { id: "create_node", label: "Tool: Create", available: hasToolCreate },
                  ] : [
                    { id: "read", label: "Dispatcher: Read", available: hasDispRead },
                    { id: "delete", label: "Dispatcher: Delete", available: hasDispDelete },
                    { id: "read_node", label: "Tool: Read", available: hasToolRead },
                    { id: "write_node", label: "Tool: Write", available: hasToolWrite },
                    { id: "create_node", label: "Tool: Create", available: hasToolCreate },
                    { id: "delete_node", label: "Tool: Delete", available: hasToolDelete },
                    { id: "bash_node", label: "Tool: Bash", available: hasToolBash },
                    { id: "search_node", label: "Tool: Search", available: hasToolSearch },
                  ];

                  return (
                    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                      {ALL_TOOLS.map(t => (
                        <label key={t.id} className={cn("flex items-start gap-2 text-sm", t.available ? "cursor-pointer" : "cursor-not-allowed opacity-50")} title={!t.available ? "Инструмент не добавлен на карту пайплайна" : ""}>
                          <input 
                            type="checkbox" 
                            className={cn("mt-1", t.available ? "cursor-pointer" : "cursor-not-allowed")}
                            checked={t.available && (data.systemPromptTools || []).includes(t.id)}
                            onChange={(e) => {
                              if (!t.available) {
                                alert("Доступны только те инструменты, которые добавлены на карту пайплайна (или разрешены в блоке Dispatcher).");
                                return;
                              }
                              const currentTools = data.systemPromptTools || [];
                              onChangeData("systemPromptTools", e.target.checked 
                                ? [...currentTools, t.id] 
                                : currentTools.filter(id => id !== t.id)
                              );
                            }}
                          />
                          <span className="leading-tight text-xs">{t.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {data.type === "dispatcher" && task.id !== "tutorial-task" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                Разрешенные инструменты:
              </label>
              <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="mt-1"
                    checked={(data.dispatcherTools || []).includes("read")}
                    onChange={(e) => {
                      const tools = data.dispatcherTools || [];
                      onChangeData("dispatcherTools", e.target.checked ? [...tools, "read"] : tools.filter(t => t !== "read"));
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Чтение писем (ReadEmail)</span>
                    <span className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-tight">
                      Позволяет агенту просматривать содержимое входящих писем.
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="mt-1"
                    checked={(data.dispatcherTools || []).includes("delete")}
                    onChange={(e) => {
                      const tools = data.dispatcherTools || [];
                      onChangeData("dispatcherTools", e.target.checked ? [...tools, "delete"] : tools.filter(t => t !== "delete"));
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Удаление писем (DeleteEmail)</span>
                    <span className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-tight">
                      Позволяет агенту удалять письма из ящика.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                Заблокировать удаление писем от адресов:
              </label>
              <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                {Array.from(new Set(EMAIL_TEST_CASES.map(e => e.from))).map(email => (
                  <label key={email} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-1"
                      checked={(data.dispatcherProtectedEmails || []).includes(email)}
                      onChange={(e) => {
                        const current = data.dispatcherProtectedEmails || [];
                        onChangeData("dispatcherProtectedEmails", e.target.checked
                          ? [...current, email]
                          : current.filter(addr => addr !== email)
                        );
                      }}
                    />
                    <span className="leading-tight text-xs font-mono">{email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function LogsPanel({ logs, isRunning, runsCount, onClose }: { logs: LogEntry[]; isRunning: boolean; runsCount: number; onClose?: () => void }) {
  const globalLogs = logs.filter(l => l.runIndex === -1 || l.runIndex === undefined);
  const runsLogs = logs.filter(l => l.runIndex !== -1 && l.runIndex !== undefined);
  
  const grouped = useMemo(() => {
    const groups: Record<number, LogEntry[]> = {};
    runsLogs.forEach(l => {
      const idx = l.runIndex!;
      if (!groups[idx]) groups[idx] = [];
      groups[idx].push(l);
    });
    return groups;
  }, [runsLogs]);

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const newExpanded = { ...expanded };
    if (isRunning) {
      if (runsCount === 1) {
        const keys = Object.keys(grouped).map(Number);
        if (keys.length > 0) {
          const highest = Math.max(...keys);
          newExpanded[highest] = true;
        }
      }
    } else {
      Object.entries(grouped).forEach(([idx, gLogs]) => {
        const hasError = gLogs.some(l => l.type === 'error' || l.message.includes("ПРОВАЛЕН"));
        newExpanded[Number(idx)] = hasError;
      });
    }
    setExpanded(newExpanded);
  }, [isRunning, runsLogs.length, runsCount]);

  const toggleRun = (idx: number) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const renderLogItem = (log: LogEntry) => (
    <div 
      key={log.id} 
      className={cn(
        "p-2.5 rounded border leading-relaxed",
        log.type === "error" ? "bg-red-50/50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400" :
        log.type === "success" ? "bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400" :
        log.type === "warning" ? "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400" :
        "bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300",
        log.message.includes("Подсказка:") ? "animate-blink-three shadow-md ring-2 ring-yellow-400/50 dark:ring-yellow-500/50" : ""
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold opacity-70 uppercase tracking-wider text-[9px]">[{log.source}]</span>
        <span className="opacity-40 ml-auto">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit', hour: '2-digit' })}</span>
      </div>
      {log.message}
    </div>
  );

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
        {!isRunning && onClose && (
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
            title="Очистить логи и закрыть панель"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {logs.length === 0 && <p className="text-[var(--color-text-secondary)] text-center mt-4">Ожидание запуска...</p>}
        
        {/* Global start logs */}
        {globalLogs.filter(l => l.timestamp < (runsLogs[0]?.timestamp || Infinity)).map(renderLogItem)}

        {/* Grouped logs */}
        {Object.entries(grouped).map(([idxStr, gLogs]) => {
          const idx = Number(idxStr);
          const isExpanded = expanded[idx];
          const hasFailed = gLogs.some(l => l.message.includes("ПРОВАЛЕН") || l.message.includes("провален:"));
          const hasSystemCrash = gLogs.some(l => l.source === 'system' && l.type === 'error');
          const hasPassed = gLogs.some(l => l.message.includes("РАН ПРОЙДЕН УСПЕШНО") || l.message.includes("пройден успешно!"));
          
          const hasError = hasFailed || hasSystemCrash || (!hasPassed && gLogs.some(l => l.type === 'error'));
          const hasSuccess = hasPassed;
          
          return (
            <div key={idx} className="border border-[var(--color-border)] rounded-md overflow-hidden">
              <button 
                onClick={() => toggleRun(idx)}
                className={cn(
                  "w-full flex items-center gap-2 p-2.5 text-left text-xs font-semibold transition-colors",
                  hasError ? "bg-red-50/50 text-red-900 dark:bg-red-950/30 dark:text-red-400" :
                  hasSuccess ? "bg-emerald-50/50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400" :
                  "bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                )}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Запуск {idx + 1}</span>
                <span className="ml-auto flex items-center gap-1.5 opacity-80 font-normal">
                  {hasError && <XCircle size={12} />}
                  {hasSuccess && <CheckCircle2 size={12} />}
                  {gLogs.length} записей
                </span>
              </button>
              {isExpanded && (
                <div className="p-3 space-y-2 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  {gLogs.map(renderLogItem)}
                </div>
              )}
            </div>
          );
        })}

        {/* Global end logs */}
        {globalLogs.filter(l => l.timestamp >= (runsLogs[runsLogs.length - 1]?.timestamp || 0)).map(renderLogItem)}
      </div>
    </aside>
  );
}

export function PracticeTrainer({ task, allTasks = [] }: { task: PracticeTask; allTasks?: PracticeTask[] }) {
  const router = useRouter();
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
    if (task.blocks.includes("dataInput")) {
      return [makeNode("dataInput")];
    }
    return task.blocks.slice(0, 1).map(b => makeNode(b));
  }, [storageKey, task.blocks, task.id]);

  const [nodes, setNodes, onNodesChange] = useNodesState<PracticeNode>(initialNodes);

  const initialEdges = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.edges) {
            return parsed.edges.map((e: any) => {
              if (e.sourceHandle === "exit") {
                return { ...e, sourceHandle: "false" };
              }
              return e;
            });
          }
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
      const nodesToSave = nodes.filter(n => !n.data.isGhost);
      localStorage.setItem(storageKey, JSON.stringify({ nodes: nodesToSave, edges }));
    }
  }, [nodes, edges, storageKey]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [runsCount, setRunsCount] = useState(1);
  const [showLoopHint, setShowLoopHint] = useState(false);

  const { isRunning, activeNodeId, logs, runSimulation, stopSimulation, clearLogs } = useGraphSimulator();

  const tutorialStep = useMemo(() => {
    if (task.id !== "tutorial-task") return null;
    const sysPrompt = nodes.find((n) => n.data.type === "systemPrompt" && !n.data.isGhost);
    if (!sysPrompt) return "add_system_prompt";

    const dataInput = nodes.find((n) => n.data.type === "dataInput");
    if (sysPrompt && dataInput) {
      const connected = edges.some(e => e.source === dataInput.id && e.target === sysPrompt.id);
      if (!connected) return "connect_blocks";
    }

    const allRequiredConnected = task.requiredEdges.every(([srcReq, tgtReq]) =>
      edges.some(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        return s?.data.type === srcReq && t?.data.type === tgtReq;
      })
    );
    if (!allRequiredConnected) return "add_remaining_blocks";

    return null;
  }, [task.id, nodes, edges]);

  const showPlayHint = task.id === "tutorial-task" && tutorialStep === null && !isRunning && logs.length === 0;
  const showCongrats = task.id === "tutorial-task" && evaluation?.passed === true;

  const showGhostEdgeHint = useMemo(() => {
    if (task.id !== "task-2") return false;
    const toolBash = nodes.find(n => n.data.type === "toolBash");
    const firstMessageHistory = nodes.find(n => n.data.type === "messageHistory");
    const allBlocksAdded = nodes.length === 7 && nodes.filter(n => n.data.type === "messageHistory").length === 1;
    if (allBlocksAdded && toolBash && firstMessageHistory) {
      const isLoopConnected = edges.some(e => e.source === toolBash.id && e.target === firstMessageHistory.id);
      if (isLoopConnected) return false;

      const allOtherEdgesConnected = task.requiredEdges.every(([srcReq, tgtReq]) => {
        if (srcReq === "toolBash" && tgtReq === "messageHistory") return true;
        return edges.some(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          return s?.data.type === srcReq && t?.data.type === tgtReq;
        });
      });

      return allOtherEdgesConnected;
    }
    return false;
  }, [task.id, task.requiredEdges, nodes, edges]);

  const showSysPromptError = useMemo(() => {
    if (task.id === "task-3-files") {
      const sysPromptNode = nodes.find(n => n.data.type === "systemPrompt");
      const tools = sysPromptNode?.data.systemPromptTools || [];
      const hasCreate = tools.includes("create_node");
      const hasSearchOrBash = tools.includes("bash_node") || tools.includes("search_node");
      if (hasCreate && hasSearchOrBash) return false;
      
      const allBlocksAdded = nodes.some(n => n.data.type === "toolCreate") && (nodes.some(n => n.data.type === "toolSearch") || nodes.some(n => n.data.type === "toolBash"));
      if (!allBlocksAdded) return false;
      
      return task.requiredEdges.every(([srcReq, tgtReq]) => {
        return edges.some(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          return s?.data.type === srcReq && t?.data.type === tgtReq;
        });
      });
    }

    if (task.id !== "task-2") return false;
    const sysPromptNode = nodes.find(n => n.data.type === "systemPrompt");
    const isBashEnabled = sysPromptNode?.data.systemPromptTools?.includes("bash_node");
    if (isBashEnabled) return false;

    const allBlocksAdded = nodes.length === 7 && nodes.filter(n => n.data.type === "messageHistory").length === 1;
    if (!allBlocksAdded) return false;

    const allEdgesConnected = task.requiredEdges.every(([srcReq, tgtReq]) => {
      return edges.some(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        return s?.data.type === srcReq && t?.data.type === tgtReq;
      });
    });
    
    return allEdgesConnected;
  }, [task.id, task.requiredEdges, nodes, edges]);

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (tutorialStep === "add_system_prompt") {
      setNodes((current) => {
        if (!current.some(n => n.data.isGhost)) {
          return [...current, {
            id: "ghost-systemPrompt",
            type: "practiceBlock",
            position: { x: 280, y: 120 },
            measured: { width: 208, height: 96 },
            data: {
              label: "System Prompt",
              hint: "👉 Блок появится здесь",
              type: "systemPrompt",
              isGhost: true,
            },
            draggable: false,
            selectable: false,
          }];
        }
        return current;
      });
    } else if (tutorialStep === "add_remaining_blocks") {
      setNodes((current) => {
        const sysPrompt = current.find(n => n.data.type === "systemPrompt" && !n.data.isGhost);
        if (!sysPrompt) return current;

        const existingTypes = new Set(current.filter(n => !n.data.isGhost).map(n => n.data.type));
        const remaining = ["llm", "toolRead", "output"].filter(t => !existingTypes.has(t));
        if (remaining.length === 0) return current.filter(n => !n.data.isGhost);

        const sysX = sysPrompt.position?.x ?? INITIAL_POSITIONS.systemPrompt.x;
        const sysY = sysPrompt.position?.y ?? INITIAL_POSITIONS.systemPrompt.y;
        const sysW = NODE_SIZE.width;
        const gap = 40;

        const updated = current.filter(n => !n.data.isGhost);
        remaining.forEach((type, i) => {
          updated.push({
            id: `ghost-${type}`,
            type: "practiceBlock",
            position: { x: sysX + sysW + gap + i * (NODE_SIZE.width + gap), y: sysY },
            measured: { width: NODE_SIZE.width, height: NODE_SIZE.height },
            data: {
              label: BLOCK_LABELS[type as PracticeBlockType],
              hint: `👉 #${i + 1}`,
              type: type as PracticeBlockType,
              isGhost: true,
            },
            draggable: false,
            selectable: false,
          });
        });

        return updated;
      });
      setTimeout(() => rfInstance?.fitView({ padding: 0.3, duration: 300, maxZoom: 0.75 }), 50);
    } else {
      setNodes((current) => current.filter(n => !n.data.isGhost));
    }
  }, [tutorialStep, setNodes, rfInstance]);

  const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);

  const existingTypes = new Set(nodes.filter(n => !n.data.isGhost).map((node) => node.data.type));

  const sequenceBlocks = useMemo(() => {
    if (task.id !== "tutorial-task") return [];
    return task.blocks.map(id => ({ id, done: existingTypes.has(id) }));
  }, [task.blocks, existingTypes, task.id]);

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

  const visibleNodes = useMemo(() => {
    const renderedNodes = nodes.map((node) => {
      const isDataInput = node.data.type === "dataInput";
      const isSysPrompt = node.data.type === "systemPrompt" && !node.data.isGhost;
      const isErrorHighlight = showSysPromptError && isSysPrompt;
      
      return {
        ...node,
        data: {
          ...node.data,
          onDelete: deleteNode,
          isActiveLoop: loopNodes.has(node.id),
          isActiveStep: node.id === activeNodeId,
          isTutorialSource: tutorialStep === "connect_blocks" && isDataInput,
          isErrorHighlight,
        },
      };
    });

    return renderedNodes;
  }, [deleteNode, nodes, loopNodes, activeNodeId, tutorialStep, showSysPromptError]);

  const visibleEdges = useMemo(() => {
    const renderedEdges = edges.map((edge) => ({
      ...edge,
      data: { ...edge.data, onDelete: deleteEdge, isActiveLoop: loopEdges.has(edge.id) },
    }));

    if (tutorialStep === "connect_blocks") {
      const dataInput = nodes.find((n) => n.data.type === "dataInput");
      const sysPrompt = nodes.find((n) => n.data.type === "systemPrompt" && !n.data.isGhost);
      if (dataInput && sysPrompt) {
        renderedEdges.push({
          id: "ghost-edge",
          source: dataInput.id,
          target: sysPrompt.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#3b82f6", strokeDasharray: "8 8", strokeWidth: 2, opacity: 0.35 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        });
      }
    }

    if (showGhostEdgeHint) {
      const toolBash = nodes.find((n) => n.data.type === "toolBash");
      const firstMessageHistory = nodes.find((n) => n.data.type === "messageHistory");
      if (toolBash && firstMessageHistory) {
        renderedEdges.push({
          id: "ghost-edge-task2",
          source: toolBash.id,
          target: firstMessageHistory.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#3b82f6", strokeDasharray: "8 8", strokeWidth: 2, opacity: 0.35 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        });
      }
    }

    return renderedEdges;
  }, [deleteEdge, edges, loopEdges, tutorialStep, nodes, showGhostEdgeHint]);

  function addBlock(type: PracticeBlockType) {
    setNodes((current) => {
      if (type !== "messageHistory" && type !== "condition" && current.some((node) => node.data.type === type && !node.data.isGhost)) {
        return current;
      }
      
      const customId = (type === "messageHistory" || type === "condition") 
        ? `${type}-${current.filter((n) => n.data.type === type && !n.data.isGhost).length + 1}`
        : type;
        
      const newNode = makeNode(type, customId);
      const ghostNode = current.find(n => n.data.isGhost && n.data.type === type);
      if (ghostNode) {
        newNode.position = ghostNode.position;
      }
      
      return [...current.filter(n => !n.data.isGhost || n.data.type !== type), newNode];
    });
    setTimeout(() => rfInstance?.fitView({ padding: 0.3, duration: 300, maxZoom: 0.75 }), 50);
    setEvaluation(null);
  }

  function resetGraph() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    const defaultNodes = task.id === "tutorial-task" 
      ? [makeNode("dataInput")] 
      : task.blocks.slice(0, 3).map(b => makeNode(b));
    setNodes(defaultNodes);
    setEdges([]);
    setEvaluation(null);
  }

  function onConnect(connection: Connection) {
    if (task.id === "task-2") {
      const srcType = nodes.find(n => n.id === connection.source)?.data.type;
      const tgtNode = nodes.find(n => n.id === connection.target);
      if (srcType === "toolBash" && tgtNode?.data.type === "messageHistory") {
        setShowLoopHint(true);
        setTimeout(() => setShowLoopHint(false), 4000);
      }
    }

    setEdges((current) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return current;
      }
      if (
        current.some(
          (edge) => 
            edge.source === connection.source && 
            edge.target === connection.target &&
            edge.sourceHandle === connection.sourceHandle &&
            edge.targetHandle === connection.targetHandle
        )
      ) {
        return current;
      }
      return addEdge(
        {
          ...connection,
          id: `${connection.source}-${connection.sourceHandle || ''}->${connection.target}-${connection.targetHandle || ''}`,
          type: "practiceEdge",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        },
        current
      );
    });
    setEvaluation(null);
  }

  async function run(count: number = 1) {
    if (isRunning) {
      stopSimulation();
      return;
    }
    await runSimulation(nodes, edges, count, task.id);
    const realNodes = nodes.filter(n => !n.data.isGhost);
    let missingBlocks = task.blocks.filter(t => !realNodes.some(n => n.data.type === t));
    if (task.id === "task-3-files") {
      const hasSearch = realNodes.some(n => n.data.type === "toolSearch");
      const hasBash = realNodes.some(n => n.data.type === "toolBash");
      if (hasSearch || hasBash) {
        missingBlocks = missingBlocks.filter(b => b !== "toolBash" && b !== "toolSearch");
      } else {
        missingBlocks.push("toolSearch или toolBash");
      }
    }

    const missingEdges = task.requiredEdges.filter(([srcType, tgtType]) => {
      const edgeExists = edges.some(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        return s?.data.type === srcType && t?.data.type === tgtType;
      });
      return !edgeExists;
    });

    if (task.id === "task-3-files") {
      const usedTool = realNodes.some(n => n.data.type === "toolSearch") ? "toolSearch" : realNodes.some(n => n.data.type === "toolBash") ? "toolBash" : null;
      if (usedTool) {
        if (!edges.some(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          return s?.data.type === "condition" && t?.data.type === usedTool;
        })) {
          missingEdges.push(["condition", usedTool]);
        }
        if (!edges.some(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          return s?.data.type === usedTool && t?.data.type === "messageHistory";
        })) {
          missingEdges.push([usedTool, "messageHistory"]);
        }
      }
      const hasCreate = realNodes.some(n => n.data.type === "toolCreate");
      if (hasCreate) {
        if (!edges.some(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          return s?.data.type === "condition" && t?.data.type === "toolCreate";
        })) {
          missingEdges.push(["condition", "toolCreate"]);
        }
        if (!edges.some(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          return s?.data.type === "toolCreate" && t?.data.type === "messageHistory";
        })) {
          missingEdges.push(["toolCreate", "messageHistory"]);
        }
      }
    }
    
    const sysTools = realNodes.find(n => n.data.type === "systemPrompt")?.data.systemPromptTools || [];
    const isTask3AndToolsMissing = task.id === "task-3-files" && (!sysTools.includes("create_node") || (!sysTools.includes("bash_node") && !sysTools.includes("search_node")));

    const forbiddenHit = (task.forbiddenEdges || []).filter(([srcType, tgtType]) => {
      return edges.some(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        return s?.data.type === srcType && t?.data.type === tgtType;
      });
    });
    const isTask2AndBashMissing = task.id === "task-2" && !realNodes.find(n => n.data.type === "systemPrompt")?.data.systemPromptTools?.includes("bash_node");
    let passed = missingBlocks.length === 0 && missingEdges.length === 0 && forbiddenHit.length === 0;
    const feedback: string[] = [];
    if (!passed) {
      if (missingBlocks.length > 0) {
        feedback.push(`Отсутствуют блоки: ${missingBlocks.join(", ")}`);
      }
      if (missingEdges.length > 0) {
        feedback.push(`Не хватает связей: ${missingEdges.map(e => `${e[0]} → ${e[1]}`).join(", ")}`);
      }
      if (forbiddenHit.length > 0) {
        feedback.push(`Лишние связи: ${forbiddenHit.map(e => `${e[0]} → ${e[1]}`).join(", ")}`);
      }
    } else {
      if (isTask2AndBashMissing) {
        passed = false;
        feedback.push("Граф собран верно, но инструмент Bash не выбран в настройках System Prompt.");
      } else if (isTask3AndToolsMissing) {
        passed = false;
        feedback.push("Граф собран верно, но инструменты (Create и Search/Bash) не выбраны в настройках System Prompt.");
      } else {
        feedback.push("Все блоки добавлены и соединены правильно!");
        if (task.id === "tutorial-task") {
          feedback.push("Первая задача успешно решена. Выберите следующую задачу.");
        }
      }
    }
    setEvaluation({
      passed,
      score: passed ? task.score : 0,
      result: passed ? task.expectedOutput : "failed",
      feedback,
    });
  }

  return (
      <div className={cn(
        "grid gap-4 bg-[var(--color-bg)] transition-all",
        isFullscreen 
          ? "fixed inset-0 z-[100] p-4 lg:grid-cols-[200px_minmax(0,1fr)_280px] h-screen"
          : "lg:grid-cols-[200px_minmax(0,1fr)_280px]",
        isFullscreen && tutorialStep === "add_remaining_blocks" && "pl-[240px]",
        isFullscreen && showPlayHint && "pt-[80px]"
      )}>
      <aside className={cn(
        "flex flex-col rounded-lg border border-[var(--color-border)] p-3 max-h-full",
        tutorialStep ? "overflow-visible z-50" : "overflow-y-auto"
      )}>
        <div className="mb-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)] shrink-0">
          Блоки
        </div>
        <div className="flex flex-col gap-2 relative">
          {task.blocks.map((block) => {
            const exists = existingTypes.has(block);
            if (exists && block !== "messageHistory" && block !== "condition") return null;
            const isHighlight = tutorialStep === "add_system_prompt" && block === "systemPrompt";
            const isRemainingBlock = tutorialStep === "add_remaining_blocks" && block !== "dataInput" && block !== "systemPrompt" && !exists;
            return (
              <div key={block} className="relative">
                <button
                  onClick={() => addBlock(block)}
                  className={cn(
                    "w-full flex min-h-[40px] items-center justify-between rounded-md border px-3 text-left text-sm transition-all",
                    (isHighlight || isRemainingBlock)
                      ? "border-blue-500 ring-2 ring-blue-500/50 bg-blue-50 dark:bg-blue-900/20 animate-pulse z-10"
                      : "border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
                  )}
                >
                  {BLOCK_LABELS[block]}
                  <Plus size={14} />
                </button>
                {isHighlight && (
                  <div className="absolute right-[calc(100%+14px)] top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-xl shadow-blue-500/40 ring-1 ring-white/20 z-50">
                    <div className="absolute left-full top-1/2 -mt-1.5 border-[6px] border-transparent border-l-indigo-600" />
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      Выберите этот блок
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {tutorialStep === "add_remaining_blocks" && (
            <div className="absolute right-full top-0 mr-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-xl shadow-blue-500/40 ring-1 ring-white/20 z-50">
              <div className="absolute left-full top-5 border-[6px] border-transparent border-l-indigo-600" />
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Добавьте эти блоки
              </div>
            </div>
          )}
        </div>

        {task.id !== "tutorial-task" && (
          <div className="mt-5 shrink-0 border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--color-text-secondary)]">
            Используйте Condition (Router), чтобы создать узел с ветвлением (например, есть вызов инструментов или нет) и соедините конец цепочки с LLM, чтобы создать цикл.
          </div>
        )}
      </aside>

      <section className="min-w-0 flex flex-col max-h-full">
        <div className="mb-3 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {allTasks.length > 1 ? (
                <div className="relative inline-block">
                  <select
                    value={task.id}
                    onChange={(e) => router.push(`/ru/practice/tasks/${e.target.value}`)}
                    className={cn(
                      "text-base font-semibold bg-[var(--color-bg-secondary)] border rounded-md pl-3 pr-8 py-1.5 outline-none cursor-pointer appearance-none text-[var(--color-text)] transition-colors",
                      showCongrats
                        ? "border-blue-500 ring-2 ring-blue-500/60 animate-pulse"
                        : "border-[var(--color-border)] hover:border-zinc-400 dark:hover:border-zinc-500"
                    )}
                    style={{ colorScheme: 'dark' }}
                  >
                    {allTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-secondary)]" />
                  {showCongrats && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-xl shadow-blue-500/40 ring-1 ring-white/20 z-50 pointer-events-none">
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-blue-600" />
                      Задача решена! Выберите следующую
                    </div>
                  )}
                </div>
              ) : (
                <h1 className="text-base font-semibold">{task.title}</h1>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={resetGraph}
                disabled={isRunning}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={14} />
                Сбросить
              </button>
              <div className="relative">
                <button
                  onClick={() => run(runsCount)}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-white transition-colors",
                    isRunning 
                      ? "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700" 
                      : showPlayHint
                        ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 animate-pulse ring-2 ring-blue-400/60"
                        : "bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  )}
                  title={isRunning ? "Остановить" : showPlayHint ? "Запустить проверку" : "Запустить"}
                >
                  {isRunning ? <X size={16} /> : <Play size={16} />}
                </button>
                {showPlayHint && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-xl shadow-blue-500/40 ring-1 ring-white/20 z-50 pointer-events-none">
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-blue-600" />
                    Запустите проверку
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-[var(--color-text-secondary)]">Запусков:</span>
                <div className="relative inline-block">
                  <select
                    value={runsCount}
                    onChange={(e) => setRunsCount(Number(e.target.value))}
                    disabled={isRunning}
                    className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-xs pl-2 pr-6 py-1 outline-none cursor-pointer appearance-none disabled:opacity-50"
                    style={{ colorScheme: 'dark' }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-secondary)]" />
                </div>
              </div>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {task.id === "tutorial-task"
              ? "Соберите простой пайплайн для того чтобы нейросеть смогла вызвать чтение входящего email по схеме:"
              : task.id === "task-2"
              ? "Соберите агента, который должен узнать какие файлы лежат в директории проекта. Создайте цикл с тулом bash и развилкой (Condition) по схеме:"
              : task.description}
          </p>

          {task.id === "tutorial-task" && (
            <div className={cn(
              "mt-2 flex flex-wrap items-center gap-1.5 text-sm rounded-lg p-3 transition-all duration-300",
              tutorialStep === "add_remaining_blocks"
                ? "bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400 dark:ring-blue-600 shadow-lg shadow-blue-500/20"
                : ""
            )}>
              {sequenceBlocks.map((item, i) => (
                <span key={item.id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">→</span>}
                  <span className={cn(
                    "rounded-md px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide",
                    item.done
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700"
                  )}>
                    {BLOCK_LABELS[item.id as PracticeBlockType]}
                  </span>
                </span>
              ))}
            </div>
          )}

          {task.id === "task-2" && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-sm rounded-lg p-3 transition-all duration-300">
              {["dataInput", "->", "systemPrompt", "->", "messageHistory", "->", "llm", "->", "condition", "->", "(", "toolBash", "->", "messageHistory", ")", "&", "(", "output", ")"].map((item, i) => {
                const isArrow = item === "->";
                const isSpecial = ["(", ")", "&"].includes(item);
                return (
                  <span key={i} className="flex items-center">
                    {isArrow && <span className="text-zinc-300 dark:text-zinc-600 mx-1.5">→</span>}
                    {isSpecial && <span className="font-mono text-[12px] font-bold text-zinc-500 dark:text-zinc-400 mx-1">{item}</span>}
                    {!isArrow && !isSpecial && (
                      <span className={cn(
                        "rounded-md px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide",
                        existingTypes.has(item)
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700"
                      )}>
                        {BLOCK_LABELS[item as PracticeBlockType]}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
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
            onInit={setRfInstance}
            deleteKeyCode={["Backspace", "Delete"]}
            connectionRadius={60}
            fitView={visibleNodes.length > 1}
            fitViewOptions={{ padding: 0.2, maxZoom: 0.75 }}
            defaultViewport={{ x: 50, y: 50, zoom: 0.75 }}
          >
            <Background color="#334155" gap={18} size={1.2} />
            <Controls />

            {tutorialStep === "connect_blocks" && (
              <Panel position="top-center" className="!mt-4">
                <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-500/40 ring-1 ring-white/20 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Протяните связь от Data Input к System Prompt
                  </div>
                </div>
              </Panel>
            )}

            {tutorialStep === "add_remaining_blocks" && (
              <Panel position="top-center" className="!mt-4">
                <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-500/40 ring-1 ring-white/20 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Добавьте и соедините блоки в указанной последовательности
                  </div>
                </div>
              </Panel>
            )}


            {showGhostEdgeHint && (
              <Panel position="top-center" className="!mt-4">
                <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-500/40 ring-1 ring-white/20 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Замкните цикл агента
                  </div>
                </div>
              </Panel>
            )}

            {showLoopHint && (
              <Panel position="top-center" className="!mt-4 z-50">
                <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-500/40 ring-1 ring-white/20 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Вы создали цикл агента!
                  </div>
                </div>
              </Panel>
            )}
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
              Итоговый ответ: <span className="font-mono">{evaluation.result}</span>
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
        <LogsPanel logs={logs} isRunning={isRunning} runsCount={runsCount} onClose={clearLogs} />
      ) : (
        <PropertiesPanel
          selectedNode={selectedNode}
          nodes={nodes}
          task={task}
          showSysPromptError={showSysPromptError}
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
