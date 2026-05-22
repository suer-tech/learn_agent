export type PracticeUserStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked";

export interface PracticeUser {
  username: string;
  telegramUserId?: number;
  status: PracticeUserStatus;
  source: string;
  lastEventAt: string;
  verifiedMonth: string;
  accessUntil: string;
}

export interface PracticeUsersFile {
  users: PracticeUser[];
}

export type PracticeProgressStatus = "not_started" | "in_progress" | "passed" | "failed";

export interface PracticeProgress {
  username: string;
  taskId: string;
  status: PracticeProgressStatus;
  score: number;
  lastResult: string;
  updatedAt: string;
}

export interface PracticeProgressFile {
  progress: PracticeProgress[];
}

export type PracticeBlockType =
  | "dataInput"
  | "llm"
  | "subAgent"
  | "tools"
  | "skills"
  | "memory"
  | "condition"
  | "dispatcher"
  | "output";

export interface PracticeTask {
  id: string;
  title: string;
  description: string;
  blocks: PracticeBlockType[];
  requiredEdges: [PracticeBlockType, PracticeBlockType][];
  forbiddenEdges: [PracticeBlockType, PracticeBlockType][];
  expectedOutput: string;
  score: number;
}

export interface PracticeTasksFile {
  tasks: PracticeTask[];
}

export interface TrainerGraph {
  nodes: Array<{
    id: string;
    type: PracticeBlockType;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
  edges: Array<{ source: string; target: string }>;
}

export interface EvaluationResult {
  passed: boolean;
  score: number;
  result: string;
  feedback: string[];
}
