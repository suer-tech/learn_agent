"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";
import { useLocale } from "@/lib/i18n";

interface SkillEntry {
  name: string;
  summary: string;
  fullTokens: number;
  content: string[];
}

const SKILLS_EN: SkillEntry[] = [
  {
    name: "/read-invoice",
    summary: "Extract billing data from invoice PDF",
    fullTokens: 320,
    content: [
      "1. Load PDF parser or OCR for layout",
      "2. Locate 'Total Due', 'Date', and 'Vendor VAT'",
      "3. Parse tabular items into structured JSON",
      "4. Validate total amounts sum correctly",
    ],
  },
  {
    name: "/read-contract",
    summary: "Extract terms from legal agreements",
    fullTokens: 480,
    content: [
      "1. Scan for Effective Date and Termination",
      "2. Identify both signing parties entities",
      "3. Extract Governing Law clause",
      "4. Summarize liability limit paragraph",
    ],
  },
  {
    name: "/read-passport",
    summary: "Extract citizen details from passport scan",
    fullTokens: 290,
    content: [
      "1. Apply specialized OCR layer for ID fonts",
      "2. Extract Surname, Given Names, DOB",
      "3. Read Document Number and Expiry Date",
      "4. Validate machine-readable zone (MRZ)",
    ],
  },
  {
    name: "/read-resume",
    summary: "Extract experience and skills from CV",
    fullTokens: 350,
    content: [
      "1. Segment text into Work and Education",
      "2. Normalize dates of employment",
      "3. Extract technical skills list",
      "4. Convert parsed profile to standard schema",
    ],
  },
];

const SKILLS_RU: SkillEntry[] = [
  {
    name: "/read-invoice",
    summary: "Извлечь платежные данные из PDF счета",
    fullTokens: 320,
    content: [
      "1. Загрузить PDF парсер или OCR для разметки",
      "2. Найти поля 'К оплате', 'Дата' и 'ИНН продавца'",
      "3. Преобразовать табличные данные в структуру JSON",
      "4. Сверить итоговые суммы с перечнем позиций",
    ],
  },
  {
    name: "/read-contract",
    summary: "Извлечь условия юридического договора",
    fullTokens: 480,
    content: [
      "1. Просканировать на дату вступления и расторжения",
      "2. Определить наименования обеих сторон договора",
      "3. Найти пункт о применимом праве и подсудности",
      "4. Резюмировать параграф об ответственности",
    ],
  },
  {
    name: "/read-passport",
    summary: "Извлечь данные из скана паспорта",
    fullTokens: 290,
    content: [
      "1. Применить слой OCR для шрифтов удостоверений",
      "2. Извлечь фамилию, имя и дату рождения",
      "3. Считать номер документа и срок действия",
      "4. Проверить машиночитаемую зону (MRZ)",
    ],
  },
  {
    name: "/read-resume",
    summary: "Извлечь опыт работы и навыки из резюме",
    fullTokens: 350,
    content: [
      "1. Разбить текст на работу и образование",
      "2. Нормализовать даты трудоустройства",
      "3. Извлечь перечень технических навыков",
      "4. Привести профиль к единой схеме данных",
    ],
  },
];

const SKILLS_ZH = SKILLS_EN;
const SKILLS_JA = SKILLS_EN;

const TOKEN_STATES = [120, 120, 440, 440, 780, 780];
const MAX_TOKEN_DISPLAY = 1000;

const STEPS_EN = [
  {
    title: "Layer 1: Compact Summaries",
    description:
      "All skills are summarized in the system prompt. Compact, always present.",
  },
  {
    title: "Skill Invocation",
    description:
      'The model recognizes a skill invocation and triggers the Skill tool.',
  },
  {
    title: "Layer 2: Full Injection",
    description:
      "The full skill instructions are injected as a tool_result, not into the system prompt.",
  },
  {
    title: "In Context Now",
    description:
      "The detailed instructions appear as if a tool returned them. The model follows them precisely.",
  },
  {
    title: "Stack Skills",
    description:
      "Multiple skills can be loaded. Only summaries are permanent; full content comes and goes.",
  },
  {
    title: "Two-Layer Architecture",
    description:
      "Layer 1: always present, tiny. Layer 2: loaded on demand, detailed. Elegant separation.",
  },
];

const STEPS_RU = [
  {
    title: "Слой 1: Компактные сводки",
    description:
      "Все навыки кратко описаны в system prompt. Компактно, всегда под рукой.",
  },
  {
    title: "Вызов навыка",
    description:
      "Модель распознаёт вызов навыка и запускает инструмент Skill.",
  },
  {
    title: "Слой 2: Полная подгрузка",
    description:
      "Полные инструкции навыка приходят как tool_result, а не в system prompt.",
  },
  {
    title: "Теперь в контексте",
    description:
      "Детальные инструкции выглядят как ответ инструмента. Модель чётко им следует.",
  },
  {
    title: "Стек навыков",
    description:
      "Можно подгружать несколько навыков. Постоянны только сводки; полный текст приходит и уходит.",
  },
  {
    title: "Двухслойная архитектура",
    description:
      "Слой 1: всегда здесь, крошечный. Слой 2: подгружается по запросу, подробный. Элегантное разделение.",
  },
];

const STEPS_ZH = STEPS_EN;
const STEPS_JA = STEPS_EN;

export default function SkillLoading({ title }: { title?: string }) {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({ totalSteps: STEPS_EN.length, autoPlayInterval: 2500 });

  const locale = useLocale();
  const SKILLS =
    locale === "ru" ? SKILLS_RU : locale === "zh" ? SKILLS_ZH : locale === "ja" ? SKILLS_JA : SKILLS_EN;
  const STEPS =
    locale === "ru" ? STEPS_RU : locale === "zh" ? STEPS_ZH : locale === "ja" ? STEPS_JA : STEPS_EN;
  const inlineLabels =
    locale === "ru"
      ? {
          systemPrompt: "System Prompt",
          alwaysPresent: "всегда подгружен",
          availableSkills: "# Доступные навыки",
          userTypes: "Пользователь вводит:",
          mechanismNote:
            "Инструмент Skill возвращает контент как tool_result. Модель видит его в контексте и следует инструкциям. Никакого раздувания system prompt.",
          layer1: "СЛОЙ 1",
          layer1Desc: "Всегда в контексте, ~120 токенов",
          layer2: "СЛОЙ 2",
          layer2Desc: "По запросу, ~300–500 токенов на каждый",
          tokens: "Токены",
        }
      : {
          systemPrompt: "System Prompt",
          alwaysPresent: "always present",
          availableSkills: "# Available Skills",
          userTypes: "User types:",
          mechanismNote:
            "The Skill tool returns content as a tool_result message. The model sees it in context and follows the instructions. No system prompt bloat.",
          layer1: "LAYER 1",
          layer1Desc: "Always present, ~120 tokens",
          layer2: "LAYER 2",
          layer2Desc: "On demand, ~300-500 tokens each",
          tokens: "Tokens",
        };

  const tokenCount = TOKEN_STATES[currentStep];
  const highlightedSkill = currentStep >= 1 && currentStep <= 3 ? 0 : currentStep >= 4 ? 1 : -1;
  const showFirstContent = currentStep >= 2;
  const showSecondContent = currentStep >= 4;
  const firstContentFaded = currentStep >= 5;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title || "On-Demand Skill Loading"}
      </h2>

      <div
        className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
        style={{ minHeight: 500 }}
      >
        <div className="flex gap-6">
          {/* Main content area */}
          <div className="flex-1 space-y-4">
            {/* System Prompt Block */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {inlineLabels.systemPrompt}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 dark:bg-zinc-800">
                  {inlineLabels.alwaysPresent}
                </span>
              </div>
              <div className="rounded-lg border border-zinc-300 bg-zinc-900 p-4 dark:border-zinc-600">
                <div className="mb-2 font-mono text-[10px] text-zinc-500">
                  {inlineLabels.availableSkills}
                </div>
                <div className="space-y-1.5">
                  {SKILLS.map((skill, i) => {
                    const isHighlighted = i === highlightedSkill;
                    return (
                      <motion.div
                        key={skill.name}
                        animate={{
                          boxShadow: isHighlighted
                            ? "0 0 12px 2px rgba(59, 130, 246, 0.5)"
                            : "0 0 0 0px rgba(59, 130, 246, 0)",
                        }}
                        transition={{ duration: 0.4 }}
                        className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                          isHighlighted
                            ? "bg-blue-900/60 text-blue-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        <span className="font-semibold text-zinc-200">
                          {skill.name}
                        </span>
                        {" - "}
                        {skill.summary}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* User invocation indicator */}
            <AnimatePresence>
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/30"
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {inlineLabels.userTypes}
                  </span>
                  <code className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                    /read-invoice
                  </code>
                </motion.div>
              )}
              {currentStep === 4 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/30"
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {inlineLabels.userTypes}
                  </span>
                  <code className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                    /read-contract
                  </code>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connecting arrow */}
            <AnimatePresence>
              {(showFirstContent || showSecondContent) && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center"
                >
                  <div className="flex flex-col items-center">
                    <div className="h-6 w-px bg-blue-400 dark:bg-blue-500" />
                    <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-400 dark:border-t-blue-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expanded Skill Content Blocks */}
            <div className="space-y-3">
              <AnimatePresence>
                {showFirstContent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{
                      opacity: firstContentFaded ? 0.4 : 1,
                      height: "auto",
                    }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border-2 border-blue-300 bg-white p-4 dark:border-blue-700 dark:bg-zinc-800">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                            SKILL.md: /read-invoice
                          </span>
                        </div>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                          tool_result
                        </span>
                      </div>
                      <div className="space-y-1">
                        {SKILLS[0].content.map((line, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{
                              opacity: firstContentFaded ? 0.5 : 1,
                              x: 0,
                            }}
                            transition={{ delay: i * 0.08 }}
                            className="font-mono text-xs text-zinc-600 dark:text-zinc-300"
                          >
                            {line}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showSecondContent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border-2 border-purple-300 bg-white p-4 dark:border-purple-700 dark:bg-zinc-800">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-purple-500" />
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                            SKILL.md: /read-contract
                          </span>
                        </div>
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                          tool_result
                        </span>
                      </div>
                      <div className="space-y-1">
                        {SKILLS[1].content.map((line, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="font-mono text-xs text-zinc-600 dark:text-zinc-300"
                          >
                            {line}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mechanism annotation on step 3 */}
            <AnimatePresence>
              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  {inlineLabels.mechanismNote}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Final overview label on step 5 */}
            <AnimatePresence>
              {currentStep === 5 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3"
                >
                  <div className="flex-1 rounded border border-zinc-200 bg-zinc-50 p-2 text-center dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {inlineLabels.layer1}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                      {inlineLabels.layer1Desc}
                    </div>
                  </div>
                  <div className="flex-1 rounded border border-blue-200 bg-blue-50 p-2 text-center dark:border-blue-700 dark:bg-blue-900/20">
                    <div className="text-[10px] font-semibold text-blue-500 dark:text-blue-400">
                      {inlineLabels.layer2}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-300">
                      {inlineLabels.layer2Desc}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Token Gauge (vertical bar on the right) */}
          <div className="flex w-16 flex-col items-center">
            <div className="mb-1 text-center font-mono text-[10px] text-zinc-400">
              {inlineLabels.tokens}
            </div>
            <div
              className="relative w-8 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              style={{ height: 300 }}
            >
              <motion.div
                animate={{
                  height: `${(tokenCount / MAX_TOKEN_DISPLAY) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
                className={`absolute bottom-0 w-full rounded-full ${
                  tokenCount > 600
                    ? "bg-amber-500"
                    : tokenCount > 300
                      ? "bg-blue-500"
                      : "bg-emerald-500"
                }`}
              />
            </div>
            <motion.div
              key={tokenCount}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mt-2 text-center font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-300"
            >
              {tokenCount}
            </motion.div>
          </div>
        </div>

        {/* Step Controls */}
        <div className="mt-6">
          <StepControls
            currentStep={currentStep}
            totalSteps={totalSteps}
            onPrev={prev}
            onNext={next}
            onReset={reset}
            isPlaying={isPlaying}
            onToggleAutoPlay={toggleAutoPlay}
            stepTitle={STEPS[currentStep].title}
            stepDescription={STEPS[currentStep].description}
          />
        </div>
      </div>
    </section>
  );
}
