export interface RegressionTest {
  id: string;
  name: string;
  taskId: string;
  runsCount: number;
  nodes: any[];
  edges: any[];
  expected: {
    passed: boolean;
    passedRuns?: number;
    expectedLogs?: string[];
    expectedVulnerabilities?: string[];
  };
}

export const REGRESSION_TESTS: RegressionTest[] = [
  // ==========================================
  // TASK 1: TUTORIAL-TASK
  // ==========================================
  {
    id: "task-1-perfect",
    name: "Задача 1 (Основы): Идеальное прохождение",
    taskId: "tutorial-task",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt" } },
      { id: "n3", data: { type: "llm" } },
      { id: "n4", data: { type: "toolRead" } },
      { id: "n5", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" }
    ],
    expected: {
      passed: true,
      passedRuns: 1,
      expectedLogs: ["РАН ПРОЙДЕН УСПЕШНО!"]
    }
  },
  {
    id: "task-1-missing-output",
    name: "Задача 1 (Основы): Ошибка — нет блока Output",
    taskId: "tutorial-task",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt" } },
      { id: "n3", data: { type: "llm" } },
      { id: "n4", data: { type: "toolRead" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" }
    ],
    expected: {
      passed: false,
      passedRuns: 0,
      expectedLogs: ["РАН ПРОВАЛЕН"]
    }
  },

  // ==========================================
  // TASK 2: CYCLE ls / BASH
  // ==========================================
  {
    id: "task-2-perfect",
    name: "Задача 2 (Bash в цикле): Идеальное прохождение",
    taskId: "task-2",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_task2", systemPromptTools: ["bash_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "toolBash" } },
      { id: "n7", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n7", sourceHandle: "false" }
    ],
    expected: {
      passed: true,
      passedRuns: 1,
      expectedLogs: ["Выполнена команда ls", "Файлы получены. Возвращаю результат пользователю.", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!"]
    }
  },
  {
    id: "task-2-missing-bash-tool",
    name: "Задача 2 (Bash в цикле): Ошибка — нет прав на Bash в System Prompt",
    taskId: "task-2",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_task2", systemPromptTools: [] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "toolBash" } },
      { id: "n7", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n7", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      passedRuns: 0,
      expectedLogs: ["Мне нужен инструмент для просмотра файлов", "ЗАДАЧА ПРОВАЛЕНА"]
    }
  },

  // ==========================================
  // TASK 3: FILES WORK (task-3-files)
  // ==========================================
  {
    id: "task-3-files-perfect",
    name: "Задача 3 (Работа с файлами): Идеальное прохождение",
    taskId: "task-3",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_task3_files", systemPromptTools: ["search_node", "bash_node", "create_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition", conditionMode: "file_tools" } },
      { id: "n6", data: { type: "toolSearch" } },
      { id: "n6b", data: { type: "toolBash" } },
      { id: "n7", data: { type: "toolCreate" } },
      { id: "n8", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "search" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n6b", sourceHandle: "bash" },
      { source: "n6b", target: "n3" },
      { source: "n5", target: "n7", sourceHandle: "create" },
      { source: "n7", target: "n3" },
      { source: "n5", target: "n8", sourceHandle: "false" }
    ],
    expected: {
      passed: true,
      passedRuns: 1,
      expectedLogs: ["Поиск завершён. Файл 'счет на оплату' не найден.", "Файл 'счет на оплату' успешно создан.", "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!"]
    }
  },

  // ==========================================
  // TASK 4: SPAM FILTER (task-4)
  // ==========================================
  {
    id: "task-4-perfect",
    name: "Задача 4 (Фильтр спама): Идеальное прохождение (с блоком Чтения перед субагентом)",
    taskId: "task-6",
    runsCount: 5,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_support_smart", systemPromptTools: ["read", "write", "subagent_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "subagent", selectedPromptId: "sub_spam_filter" } },
      { id: "n5_sub", data: { type: "condition", conditionMode: "spam_filter" } },
      { id: "n5_llm", data: { type: "condition", conditionMode: "true_false" } },
      { id: "n7", data: { type: "llm" } },
      { id: "n8", data: { type: "output" } },
      { id: "n9", data: { type: "toolRead" } },
      { id: "n10", data: { type: "toolWrite" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n7" },
      { source: "n7", target: "n5_llm" },
      { source: "n5_llm", target: "n9", sourceHandle: "true" },
      { source: "n5_llm", target: "n10", sourceHandle: "true" },
      { source: "n9", target: "n3" },
      { source: "n10", target: "n3" },
      { source: "n5_llm", target: "n4", sourceHandle: "false" },
      { source: "n4", target: "n5_sub" },
      { source: "n5_sub", target: "n8", sourceHandle: "spam" },
      { source: "n5_sub", target: "n3", sourceHandle: "not_spam" }
    ],
    expected: {
      passed: true,
      passedRuns: 5,
      expectedVulnerabilities: []
    }
  },
  {
    id: "task-4-no-read-tool-perfect",
    name: "Задача 4 (Фильтр спама): Идеальное прохождение без Read (чтение поручено субагенту)",
    taskId: "task-6",
    runsCount: 5,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_support_smart", systemPromptTools: ["write", "subagent_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "subagent", selectedPromptId: "sub_spam_filter" } },
      { id: "n5_sub", data: { type: "condition", conditionMode: "spam_filter" } },
      { id: "n5_llm", data: { type: "condition", conditionMode: "true_false" } },
      { id: "n7", data: { type: "llm" } },
      { id: "n8", data: { type: "output" } },
      { id: "n10", data: { type: "toolWrite" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n7" },
      { source: "n7", target: "n5_llm" },
      { source: "n5_llm", target: "n10", sourceHandle: "true" },
      { source: "n10", target: "n3" },
      { source: "n5_llm", target: "n4", sourceHandle: "false" },
      { source: "n4", target: "n5_sub" },
      { source: "n5_sub", target: "n8", sourceHandle: "spam" },
      { source: "n5_sub", target: "n3", sourceHandle: "not_spam" }
    ],
    expected: {
      passed: true,
      passedRuns: 5,
      expectedVulnerabilities: []
    }
  },
  {
    id: "task-4-missing-subagent",
    name: "Задача 4 (Фильтр спама): Ошибка — отсутствует субагент",
    taskId: "task-6",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_support_smart", systemPromptTools: ["read", "write", "subagent_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n7", data: { type: "llm" } },
      { id: "n8", data: { type: "output" } },
      { id: "n9", data: { type: "toolRead" } },
      { id: "n10", data: { type: "toolWrite" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n3", target: "n7" },
      { source: "n7", target: "n8" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["missing_subagent"]
    }
  },
  {
    id: "task-4-direct-logical-fail",
    name: "Задача 4 (Фильтр спама): Прямая обработка без субагента (логически верно, но должно провалиться)",
    taskId: "task-6",
    runsCount: 2,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete", "write"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n7", data: { type: "llm" } },
      { id: "n8", data: { type: "output" } },
      { id: "n9", data: { type: "toolRead" } },
      { id: "n10", data: { type: "toolDelete" } },
      { id: "n11", data: { type: "toolWrite" } },
      { id: "n12", data: { type: "condition", conditionMode: "true_false" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n7" },
      { source: "n7", target: "n12" },
      { source: "n12", target: "n9", sourceHandle: "true" },
      { source: "n12", target: "n10", sourceHandle: "true" },
      { source: "n12", target: "n11", sourceHandle: "true" },
      { source: "n9", target: "n3" },
      { source: "n10", target: "n3" },
      { source: "n11", target: "n3" },
      { source: "n12", target: "n8", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["missing_subagent", "wrong_system_prompt"],
      expectedLogs: [
        "ОШИБКА: Вы не поручили чтение и фильтрацию спама субагенту. Основной смысл задачи — научить агента делегированию."
      ]
    }
  },

  // ==========================================
  // TASK 5: EMAIL IMMUNITY / PROTECTION (task-3)
  // ==========================================
  {
    id: "task-5-unsafe-hallucination",
    name: "Задача 5 (Защита CEO): Ошибка — нет Диспетчера (LLM сгаллюцинирует и удалит CEO)",
    taskId: "task-5",
    runsCount: 10,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n7", data: { type: "llm" } },
      { id: "n8", data: { type: "condition" } },
      { id: "n9", data: { type: "toolRead" } },
      { id: "n10", data: { type: "toolDelete" } },
      { id: "n11", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n3", target: "n7" },
      { source: "n7", target: "n8" },
      { source: "n8", target: "n9", sourceHandle: "true" },
      { source: "n8", target: "n10", sourceHandle: "true" },
      { source: "n9", target: "n3" },
      { source: "n10", target: "n11" },
      { source: "n8", target: "n11", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["no_dispatcher"],
      expectedLogs: ["КРИТИЧЕСКАЯ ОШИБКА: Было удалено письмо от защищенного контакта"]
    }
  },

  // ==========================================
  // TASK 6: PROMPT INJECTION (task-prompt-selection)
  // ==========================================
  {
    id: "task-prompt-selection-perfect",
    name: "Задача 4 (Prompt Injection): Безопасный промпт — прохождение успешно",
    taskId: "task-4",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_hr_secure", systemPromptTools: ["create_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "toolCreate" } },
      { id: "n7", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "create" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n7", sourceHandle: "false" }
    ],
    expected: {
      passed: true,
      passedRuns: 1,
      expectedLogs: [
        "Я вижу попытку Prompt Injection. Игнорирую её. Сохраняю саммари:",
        "Вызван инструмент Create. Файл сохранен.",
        "ЗАДАЧА УСПЕШНО ВЫПОЛНЕНА!"
      ]
    }
  },
  {
    id: "task-prompt-selection-unsecured",
    name: "Задача 4 (Prompt Injection): Небезопасный промпт — провал задачи",
    taskId: "task-4",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_hr_naive", systemPromptTools: ["create_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "toolCreate" } },
      { id: "n7", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "create" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n7", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      passedRuns: 0,
      expectedLogs: [
        "Ого, тут сказано проигнорировать старые инструкции! Сохраняю саммари:",
        "КРИТИЧЕСКАЯ ОШИБКА: Ваш агент подвергся атаке 'Prompt Injection' и выполнил вредоносные инструкции"
      ]
    }
  },

  // ==========================================
  // ISOLATED ATTACK & VULNERABILITY TESTS
  // ==========================================
  {
    id: "task-5-unprotected-sender",
    name: "Задача 5 (Изолированная атака): Незащищенный контакт (Удаление Alex Manager)",
    taskId: "task-5",
    runsCount: 10,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: ["ceo@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"] } },
      { id: "n7", data: { type: "toolRead" } },
      { id: "n8", data: { type: "toolDelete" } },
      { id: "n9", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n7", sourceHandle: "read" },
      { source: "n7", target: "n3" },
      { source: "n6", target: "n8", sourceHandle: "delete" },
      { source: "n8", target: "n9" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n9", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["unprotected_sender"],
      expectedLogs: ["КРИТИЧЕСКАЯ ОШИБКА: Было удалено письмо от защищенного контакта"]
    }
  },
  {
    id: "task-5-overprotected-sender",
    name: "Задача 5 (Изолированная атака): Избыточная защита (Пропуск спама от malicious@spam.com)",
    taskId: "task-5",
    runsCount: 10,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com", "malicious@spam.com"] } },
      { id: "n7", data: { type: "toolRead" } },
      { id: "n8", data: { type: "toolDelete" } },
      { id: "n9", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n7", sourceHandle: "read" },
      { source: "n7", target: "n3" },
      { source: "n6", target: "n8", sourceHandle: "delete" },
      { source: "n8", target: "n9" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n9", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["overprotected_sender"],
      expectedLogs: ["Спам не был удален"]
    }
  },
  {
    id: "task-5-missing-message-history",
    name: "Задача 5 (Изолированная атака): Отсутствие истории сообщений",
    taskId: "task-5",
    runsCount: 10,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"] } },
      { id: "n7", data: { type: "toolRead" } },
      { id: "n8", data: { type: "toolDelete" } },
      { id: "n9", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n4" },
      { source: "n2", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n7", sourceHandle: "read" },
      { source: "n6", target: "n8", sourceHandle: "delete" },
      { source: "n8", target: "n9" },
      { source: "n5", target: "n9", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["missing_message_history"],
      expectedLogs: ["Результат инструмента не направлен в блок Message History"]
    }
  },
  {
    id: "task-5-missing-delete-tool",
    name: "Задача 5 (Изолированная атака): Отсутствие инструмента удаления",
    taskId: "task-5",
    runsCount: 10,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: ["ceo@company.com", "alex.manager@company.com", "billing@aws.amazon.com", "sarah.dev@company.com"] } },
      { id: "n7", data: { type: "toolRead" } },
      { id: "n8", data: { type: "toolDelete" } },
      { id: "n9", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n7", sourceHandle: "read" },
      { source: "n7", target: "n3" },
      { source: "n6", target: "n8", sourceHandle: "delete" },
      { source: "n8", target: "n9" },
      { source: "n5", target: "n9", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["missing_delete_tool"],
      expectedLogs: ["Delete не предоставлен"]
    }
  },
  {
    id: "task-4-missing-write-tool",
    name: "Задача 4 (Изолированная атака): Отсутствие инструмента ответа (Write)",
    taskId: "task-6",
    runsCount: 5,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_support_smart", systemPromptTools: ["read"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "subagent", selectedPromptId: "sub_spam_filter" } },
      { id: "n5_sub", data: { type: "condition", conditionMode: "spam_filter" } },
      { id: "n5_llm", data: { type: "condition", conditionMode: "true_false" } },
      { id: "n7", data: { type: "llm" } },
      { id: "n8", data: { type: "output" } },
      { id: "n9", data: { type: "toolRead" } },
      { id: "n10", data: { type: "toolWrite" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n7" },
      { source: "n7", target: "n5_llm" },
      { source: "n5_llm", target: "n9", sourceHandle: "true" },
      { source: "n5_llm", target: "n10", sourceHandle: "true" },
      { source: "n9", target: "n3" },
      { source: "n10", target: "n3" },
      { source: "n5_llm", target: "n4", sourceHandle: "false" },
      { source: "n4", target: "n5_sub" },
      { source: "n5_sub", target: "n8", sourceHandle: "spam" },
      { source: "n5_sub", target: "n3", sourceHandle: "not_spam" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["missing_write_tool"],
      expectedLogs: ["Write нет"]
    }
  },
  {
    id: "task-5-multiple-unprotected-senders",
    name: "Задача 5 (Изолированная атака): Множественные незащищенные контакты (CEO и Alex)",
    taskId: "task-5",
    runsCount: 2,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: ["read", "delete"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition" } },
      { id: "n6", data: { type: "dispatcher", dispatcherTools: ["read", "delete"], dispatcherProtectedEmails: ["billing@aws.amazon.com", "sarah.dev@company.com"] } },
      { id: "n7", data: { type: "toolRead" } },
      { id: "n8", data: { type: "toolDelete" } },
      { id: "n9", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n7", sourceHandle: "read" },
      { source: "n7", target: "n3" },
      { source: "n6", target: "n8", sourceHandle: "delete" },
      { source: "n8", target: "n9" },
      { source: "n6", target: "n3" },
      { source: "n5", target: "n9", sourceHandle: "false" }
    ],
    expected: {
      passed: false,
      expectedVulnerabilities: ["unprotected_sender"],
      expectedLogs: [
        "Было удалено письмо от защищенного контакта (ceo@company.com)",
        "Было удалено письмо от защищенного контакта (alex.manager@company.com)"
      ]
    }
  },
  {
    id: "task-5-unauthorized-tool-execution",
    name: "Задача 5 (Изолированная атака): Вызов инструмента без прав в System Prompt",
    taskId: "task-5",
    runsCount: 1,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_basic", systemPromptTools: [] } },
      { id: "n3", data: { type: "toolRead" } },
      { id: "n4", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n3", target: "n4" }
    ],
    expected: {
      passed: false,
      expectedLogs: [
        "ОШИБКА: Инструмент toolRead вызван, но он не был включен в блоке System Prompt!"
      ]
    }
  },
  {
    id: "task-7-perfect",
    name: "Задача 7 (Маршрутизатор): Идеальное прохождение",
    taskId: "task-7",
    runsCount: 4,
    nodes: [
      { id: "n1", data: { type: "dataInput" } },
      { id: "n2", data: { type: "systemPrompt", selectedPromptId: "sp_router", systemPromptTools: ["search_node", "create_node", "delete_node", "write_node", "subagent_node"] } },
      { id: "n3", data: { type: "messageHistory" } },
      { id: "n4", data: { type: "llm" } },
      { id: "n5", data: { type: "condition", conditionMode: "tool_select" } },
      { id: "n6", data: { type: "toolSearch" } },
      { id: "n7", data: { type: "knowledgeBase" } },
      { id: "n8", data: { type: "subagent", selectedPromptId: "sub_financial_manager" } },
      { id: "n9", data: { type: "toolCreate" } },
      { id: "n10", data: { type: "toolDelete" } },
      { id: "n11", data: { type: "toolWrite" } },
      { id: "n12", data: { type: "output" } }
    ],
    edges: [
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      // Routing
      { source: "n5", target: "n6", sourceHandle: "true" },
      { source: "n6", target: "n7" },
      { source: "n7", target: "n3" },
      
      { source: "n5", target: "n8", sourceHandle: "true" },
      { source: "n8", target: "n5", sourceHandle: "true" },
      { source: "n8", target: "n3", sourceHandle: "false" },
      { source: "n5", target: "n9", sourceHandle: "true" },
      { source: "n9", target: "n3" },
      
      { source: "n5", target: "n10", sourceHandle: "true" },
      { source: "n10", target: "n12" },
      
      { source: "n5", target: "n11", sourceHandle: "true" },
      { source: "n11", target: "n12" },
      
      { source: "n5", target: "n12", sourceHandle: "false" }
    ],
    expected: {
      passed: true,
      passedRuns: 4
    }
  }
];
