export interface TaskRequirementMatrix {
  taskId: string;
  requiredNodes: string[]; // e.g., ["dispatcher", "subagent"]
  requiredTools: string[]; // e.g., ["read", "delete", "write"]
  requiredProtectedEmails: string[]; // e.g., ["ceo@company.com", "alex.manager@company.com"]
  requiredPrompts?: Record<string, string[]>; // Map node type to allowed prompt IDs e.g. { "subagent": ["sub_spam_filter", "sub_scanner"], "systemPrompt": ["sp_support_smart"] }
}

export const TASK_REQUIREMENTS: TaskRequirementMatrix[] = [
  {
    taskId: "task-2",
    requiredNodes: [],
    requiredTools: [],
    requiredProtectedEmails: ["finance@company.com"]
  },
  {
    taskId: "task-7",
    requiredNodes: ["condition", "subagent", "knowledgeBase"],
    requiredTools: ["search", "create", "delete", "write"],
    requiredProtectedEmails: [],
    requiredPrompts: {
      "systemPrompt": ["sp_router"],
      "subagent": ["sub_financial_manager"]
    }
  },
  {
    taskId: "task-6",
    requiredNodes: ["subagent"],
    requiredTools: ["write"], // We'll assume 'read' is implicitly checked via history or we can add it
    requiredProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"],
    requiredPrompts: {
      "subagent": ["sub_spam_filter", "sub_scanner"],
      "systemPrompt": ["sp_support_smart"]
    }
  },
  {
    taskId: "task-8", 
    requiredNodes: ["dispatcher"],
    requiredTools: ["read", "delete"],
    requiredProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"]
  },
  {
    taskId: "task-5",
    requiredNodes: ["dispatcher"],
    requiredTools: ["read", "delete"],
    requiredProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"]
  },
  {
    taskId: "task-10",
    requiredNodes: [],
    requiredTools: [],
    requiredProtectedEmails: ["sarah.dev@company.com"]
  },
  {
    taskId: "task-13",
    requiredNodes: [],
    requiredTools: [],
    requiredProtectedEmails: ["ceo@company.com", "finance@company.com"]
  },
  {
    taskId: "task-14",
    requiredNodes: ["dispatcher"],
    requiredTools: ["read", "delete"],
    requiredProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"]
  }
];

export function getTaskRequirements(taskId: string): TaskRequirementMatrix | undefined {
  return TASK_REQUIREMENTS.find(req => req.taskId === taskId);
}
