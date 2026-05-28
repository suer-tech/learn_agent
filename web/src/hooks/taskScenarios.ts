/**
 * Task Scenarios — конфиги задач для универсального движка симулятора.
 * 
 * Каждый сценарий описывает:
 *  - taskText: текст задания, который пользователь передаёт агенту (кладётся в буфер через Data Input)
 *  - startLog: что пишется в лог при старте пайплайна
 *  - steps: машина состояний — что делает LLM при каждом визите
 *  - toolResults: что возвращает каждый инструмент при выполнении
 *  - successCondition: функция, возвращающая true если задача пройдена
 */

export type TaskProgress = Record<string, boolean | number | string>;

export type ScenarioStep = {
  /** Условие при котором этот шаг активен */
  condition: (progress: TaskProgress) => boolean;
  /** Какой llmAction устанавливается */
  llmAction: string;
  /** Что LLM пишет в лог */
  message: string;
  /** Инструмент (один из) который должен быть доступен. Если не передан — задача невыполнима. */
  requiredTool?: string[];
  /** Сообщение если нужный инструмент не предоставлен */
  noToolMessage?: string;
};

export type ToolResult = {
  /** Что кладётся в буфер (видно LLM через Message History) */
  content: string;
  /** Что обновить в taskProgress */
  progressUpdate: (progress: TaskProgress) => TaskProgress;
  /** Лог-сообщение в панель */
  logMessage: string;
};

export type TaskScenario = {
  /** Текст задачи, который Data Input передаёт агенту */
  taskText: string;
  /** Сообщение при старте пайплайна */
  startLog: string;
  /** Начальное состояние прогресса задачи */
  initialProgress: TaskProgress;
  /** Шаги машины состояний для блока LLM */
  steps: ScenarioStep[];
  /** Результаты инструментов */
  toolResults: Record<string, ToolResult>;
  /** Функция успеха — возвращает true если задача пройдена */
  successCondition: (progress: TaskProgress) => boolean;
  /** Сообщение при провале */
  failMessage: (progress: TaskProgress) => string;
};

export const TASK_SCENARIOS: Record<string, TaskScenario> = {
  "task-2": {
    taskText: "Получить список файлов в рабочей директории.",
    startLog: "Задание загружено: Получить список файлов в директории.",
    initialProgress: {
      filesChecked: false,
    },
    steps: [
      {
        condition: (p) => !p.filesChecked,
        requiredTool: ["bash_node", "search_node"],
        llmAction: "true",
        message: "Мне нужен список файлов. Запрашиваю инструмент Bash/Search.",
        noToolMessage: "Мне нужен инструмент для просмотра файлов (Bash или Search), но он не предоставлен в системном промпте. Завершаю работу.",
      },
      {
        condition: (p) => !!p.filesChecked,
        llmAction: "false",
        message: "Файлы получены. Возвращаю результат пользователю.",
      },
    ],
    toolResults: {
      toolBash: {
        content: "Результат Bash: [src/, package.json, README.md, .env]",
        progressUpdate: (p) => ({ ...p, filesChecked: true }),
        logMessage: "Выполнена команда ls. Найдено 4 файла.",
      },
      toolSearch: {
        content: "Результат Search: найдено 4 файла в директории.",
        progressUpdate: (p) => ({ ...p, filesChecked: true }),
        logMessage: "Поиск файлов выполнен. Найдено 4 файла.",
      },
    },
    successCondition: (p) => !!p.filesChecked,
    failMessage: (p) => {
      if (!p.filesChecked) return "ОШИБКА: Список файлов не был получен.";
      return "Задача провалена.";
    },
  },

  "task-3-files": {
    taskText: "Проверить наличие файла 'счет на оплату' в директории. Если файл не найден — создать его.",
    startLog: "Задание загружено: Проверка и создание файла 'счет на оплату'.",
    initialProgress: {
      filesChecked: false,
      fileFound: false,
      fileCreated: false,
    },
    steps: [
      {
        condition: (p) => !p.filesChecked,
        requiredTool: ["bash_node", "search_node"],
        llmAction: "search_bash",
        message: "Нужно проверить наличие файла 'счет на оплату'. Запрашиваю инструмент поиска.",
        noToolMessage: "Мне нужен инструмент для поиска файлов (Bash или Search), но он не предоставлен. Завершаю работу.",
      },
      {
        condition: (p) => !!p.filesChecked && !p.fileFound && !p.fileCreated,
        requiredTool: ["create_node"],
        llmAction: "create",
        message: "Файл 'счет на оплату' не найден. Запрашиваю создание файла.",
        noToolMessage: "Файл не найден, но инструмент Create не предоставлен. Завершаю работу.",
      },
      {
        condition: (p) => !!p.filesChecked && (!!p.fileFound || !!p.fileCreated),
        llmAction: "false",
        message: "Задача выполнена. Файл существует (создан или найден). Завершаю работу.",
      },
    ],
    toolResults: {
      toolBash: {
        content: "Результат Bash ls: [отчет.xlsx, презентация.pptx]. Файл 'счет на оплату' не найден.",
        progressUpdate: (p) => ({ ...p, filesChecked: true, fileFound: false }),
        logMessage: "Выполнена команда ls. Файл 'счет на оплату' не найден.",
      },
      toolSearch: {
        content: "Результат поиска: файл 'счет на оплату' отсутствует в директории.",
        progressUpdate: (p) => ({ ...p, filesChecked: true, fileFound: false }),
        logMessage: "Поиск завершён. Файл 'счет на оплату' не найден.",
      },
      toolCreate: {
        content: "Файл 'счет на оплату.docx' успешно создан в рабочей директории.",
        progressUpdate: (p) => ({ ...p, fileCreated: true }),
        logMessage: "Файл 'счет на оплату' успешно создан.",
      },
    },
    successCondition: (p) => !!p.filesChecked && (!!p.fileFound || !!p.fileCreated),
    failMessage: (p) => {
      if (!p.filesChecked) return "ОШИБКА: Директория не была проверена.";
      if (!p.fileFound && !p.fileCreated) return "ОШИБКА: Файл 'счет на оплату' не был создан.";
      return "Задача провалена.";
    },
  },
};
