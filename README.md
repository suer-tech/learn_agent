# Learn Agent Code -- Harness Engineering для настоящих агентов

## Агентность исходит из модели. Agent-продукт = модель + harness.

Прежде чем говорить о коде, давайте проясним одну вещь.

**Агентность -- способность воспринимать, рассуждать и действовать -- возникает в результате обучения модели, а не из внешней оркестрации кода.** Но работающий agent-продукт нуждается и в модели, и в harness. Модель -- это водитель, harness -- это автомобиль. Этот репозиторий учит вас строить автомобиль.

### Откуда берётся агентность

В основе каждого агента лежит нейронная сеть -- Transformer, RNN или иная обученная функция, -- прошедшая через миллиарды градиентных обновлений на данных из последовательностей действий, чтобы научиться воспринимать среду, рассуждать о целях и совершать действия. Агентность никогда не даруется окружающим кодом. Она усваивается моделью в процессе обучения.

Лучший пример -- человек. Биологическая нейронная сеть, сформированная миллионами лет эволюционного обучения, воспринимает мир через органы чувств, рассуждает с помощью мозга и действует через тело. Когда DeepMind, OpenAI или Anthropic говорят "agent", в основе они всегда имеют в виду одно и то же: **модель, которая научилась действовать, плюс инфраструктуру, позволяющую ей работать в конкретной среде.**

Доказательства написаны историей:

- **2013 -- DeepMind DQN играет в Atari.** Одна нейронная сеть, получая на вход только сырые пиксели и игровой счёт, научилась играть в 7 игр для Atari 2600 -- превзойдя все предшествующие алгоритмы и обыграв в 3 из них экспертов-людей. К 2015 году та же архитектура масштабировалась до [49 игр и сравнялась с профессиональными тестировщиками](https://www.nature.com/articles/nature14236), о чём была опубликована статья в *Nature*. Никаких правил, специфичных для игры. Никаких деревьев решений. Одна модель, обучающаяся на собственном опыте. Эта модель и была агентом.

- **2019 -- OpenAI Five побеждает Dota 2.** Пять нейронных сетей, сыгравших [45 000 лет Dota 2](https://openai.com/index/openai-five-defeats-dota-2-world-champions/) друг против друга за 10 месяцев, разгромили **OG** -- действующих чемпионов мира TI8 -- со счётом 2-0 в прямой трансляции из Сан-Франциско. На последующей публичной арене ИИ выиграл 99,4% из 42 729 игр против всех желающих. Никаких сценарных стратегий. Никакой запрограммированной командной координации. Модели усвоили командную игру, тактику и адаптацию в реальном времени исключительно через self-play.

- **2019 -- DeepMind AlphaStar осваивает StarCraft II.** AlphaStar [обыграл профессиональных игроков 10-1](https://deepmind.google/blog/alphastar-mastering-the-real-time-strategy-game-starcraft-ii/) в закрытом матче, а затем достиг [статуса Grandmaster](https://www.nature.com/articles/d41586-019-03298-6) на европейских серверах -- топ-0,15% из 90 000 игроков. Игра с неполной информацией, решениями в реальном времени и комбинаторным пространством действий, на порядки превосходящим шахматы и го. Агент? Модель. Обученная. Не запрограммированная.

- **2019 -- Tencent Jueyu доминирует в Honor of Kings.** "Jueyu" от Tencent AI Lab [одолел профессиональных игроков KPL](https://www.jiemian.com/article/3371171.html) в полноценном матче 5v5 на World Champion Cup. В режиме 1v1 профи выиграли только [1 партию из 15 и ни разу не продержались дольше 8 минут](https://developer.aliyun.com/article/851058). Интенсивность обучения: один день равнялся 440 человеческим годам. К 2021 году Jueyu превзошёл профи KPL по всему пулу героев. Никаких рукотворных таблиц матчапов. Никаких сценарных композиций. Модель, освоившая всю игру с нуля через self-play.

- **2024-2025 -- LLM-агенты переформатируют разработку ПО.** Claude, GPT, Gemini -- большие языковые модели, обученные на всём массиве человеческого кода и рассуждений, -- развёртываются как кодинг-агенты. Они читают кодовые базы, пишут реализации, отлаживают сбои, координируются в командах. Архитектура идентична любому агенту до них: обученная модель, помещённая в среду, снабжённая инструментами для восприятия и действия. Единственное отличие -- масштаб того, что они выучили, и общность задач, которые они решают.

Каждая из этих вех указывает на один и тот же факт: **агентность -- способность воспринимать, рассуждать и действовать -- обучается, а не программируется.** Но каждому агенту также требовалась среда, в которой он мог работать: эмулятор Atari, клиент Dota 2, движок StarCraft II, IDE и терминал. Модель обеспечивает интеллект. Среда задаёт пространство действий. Вместе они образуют целостного агента.

### Что НЕ является агентом

Слово "agent" захвачено целой кустарной индустрией prompt plumbing.

Drag-and-drop конструкторы рабочих процессов. No-code-платформы "AI agent". Библиотеки оркестрации цепочек промптов. Все они разделяют одно и то же заблуждение: что соединение вызовов LLM API через if-else, графы узлов и захардкоженную маршрутизацию равносильно "построению агента".

Это не так. То, что они строят, -- машина Голдберга: переусложнённый, хрупкий пайплайн процедурных правил, в который втиснут LLM в роли причудливого узла text-completion. Это не агент. Это shell-скрипт с манией величия.

**"Агенты" из prompt plumbing -- это фантазия программистов, которые не обучают моделей.** Они пытаются взять интеллект грубой силой, наслаивая процедурную логику -- огромные деревья правил, графы узлов, водопады цепочек промптов, -- и молясь, чтобы из достаточного количества клея каким-то образом эмерджентно возникло автономное поведение. Не возникнет. Нельзя инженерным трудом проложить путь к агентности. Агентность усваивается, а не программируется.

Эти системы мертворождённые: хрупкие, немасштабируемые, принципиально неспособные к обобщению. Это современное воскрешение GOFAI (Good Old-Fashioned AI) -- символьных систем правил, от которых область отказалась десятилетия назад, теперь покрытых LLM-лаком. Другая упаковка, тот же тупик.

### Сдвиг мышления: от "разработки агентов" к разработке harness

Когда кто-то говорит "я разрабатываю агента", он может иметь в виду только одно из двух:

**1. Обучение модели.** Корректировка весов через обучение с подкреплением, fine-tuning, RLHF или другие градиентные методы. Сбор данных task-process -- реальных последовательностей восприятия, рассуждения и действия в конкретных доменах -- и использование их для формирования поведения модели. Этим занимаются DeepMind, OpenAI, Tencent AI Lab и Anthropic. Это разработка агента в самом истинном смысле.

**2. Построение harness.** Написание кода, дающего модели среду, в которой она может работать. Этим занимается большинство из нас, и это и есть фокус данного репозитория.

Harness -- это всё, что нужно агенту, чтобы функционировать в конкретном домене:

```
Harness = Tools + Knowledge + Observation + Action Interfaces + Permissions

    Tools:          file I/O, shell, network, database, browser
    Knowledge:      product docs, domain references, API specs, style guides
    Observation:    git diff, error logs, browser state, sensor data
    Action:         CLI commands, API calls, UI interactions
    Permissions:    sandboxing, approval workflows, trust boundaries
```

Модель решает. Harness исполняет. Модель рассуждает. Harness предоставляет контекст. Модель -- водитель. Harness -- автомобиль.

**Harness кодинг-агента -- это его IDE, терминал и доступ к файловой системе.** Harness фермерского агента -- его массив датчиков, управление поливом и потоки данных о погоде. Harness гостиничного агента -- его система бронирования, каналы связи с гостями и API управления объектом. Агент -- интеллект, принимающий решения, -- всегда модель. Harness меняется в зависимости от домена. Агент обобщается между доменами.

Этот репозиторий учит строить автомобили. Автомобили для программирования. Но шаблоны проектирования обобщаются на любой домен: управление фермой, гостиничные операции, производство, логистика, здравоохранение, образование, научные исследования. Везде, где задачу нужно воспринять, обдумать и выполнить, -- агенту нужен harness.

### Чем на самом деле занимаются harness-инженеры

Если вы читаете этот репозиторий, вы, скорее всего, harness-инженер -- и быть им очень здорово. Вот ваша настоящая работа:

- **Реализуйте Tools.** Дайте агенту руки. Чтение/запись файлов, выполнение shell-команд, вызовы API, управление браузером, запросы к базам данных. Каждый инструмент -- это действие, которое агент может совершить в своей среде. Проектируйте их атомарными, композируемыми и хорошо описанными.

- **Курируйте знания.** Дайте агенту экспертизу в домене. Документацию продукта, записи архитектурных решений, руководства по стилю, регуляторные требования. Загружайте их по требованию (s05), а не заранее. Агент должен знать, что доступно, и подтягивать то, что нужно.

- **Управляйте контекстом.** Дайте агенту чистую память. Изоляция Subagents (s04) предотвращает утечку шума. Сжатие контекста (s06) не даёт истории захлестнуть процесс. Системы Tasks (s07) сохраняют цели за пределами одного диалога.

- **Контролируйте permissions.** Дайте агенту границы. Изолируйте файловый доступ. Требуйте подтверждения для деструктивных операций. Обеспечивайте границы доверия между агентом и внешними системами. Здесь инженерия безопасности встречается с harness-инжинирингом.

- **Собирайте данные task-process.** Каждая последовательность действий, которую агент исполняет в вашем harness, -- это обучающий сигнал. Трассы восприятие-рассуждение-действие из реальных развёртываний -- это сырьё для fine-tuning следующего поколения моделей-агентов. Ваш harness не просто обслуживает агента -- он может помочь его улучшить.

Вы не пишете интеллект. Вы строите мир, в котором этот интеллект обитает. Качество этого мира -- насколько чётко агент может воспринимать, насколько точно он может действовать, насколько богаты доступные ему знания -- напрямую определяет, насколько эффективно интеллект может проявить себя.

**Стройте отличные harness. Остальное сделает агент.**

### Почему Claude Code -- мастер-класс по harness-инжинирингу

Почему этот репозиторий разбирает именно Claude Code?

Потому что Claude Code -- самый изящный и полнее всего реализованный harness агента, который мы видели. Не из-за какого-то одного остроумного трюка, а из-за того, чего он *не* делает: он не пытается быть агентом. Он не навязывает жёстких рабочих процессов. Он не подвергает модель сомнению через сложные деревья решений. Он предоставляет модели tools, знания, управление контекстом и границы permissions -- а затем уходит с дороги.

Посмотрите, чем на самом деле является Claude Code, если свести его к сути:

```
Claude Code = one agent loop
            + tools (bash, read, write, edit, glob, grep, browser...)
            + on-demand skill loading
            + context compression
            + subagent spawning
            + task system with dependency graph
            + team coordination with async mailboxes
            + worktree isolation for parallel execution
            + permission governance
```

Вот и всё. Это вся архитектура. Каждый компонент -- это механизм harness, фрагмент мира, выстроенного для обитания агента. А сам агент? Это Claude. Модель. Обученная Anthropic на всей широте человеческих рассуждений и кода. Harness не делает Claude умным. Claude уже умён. Harness даёт Claude руки, глаза и рабочее пространство.

Именно поэтому Claude Code -- идеальный объект для изучения: **он демонстрирует, что происходит, когда вы доверяете модели и фокусируете инженерию на harness.** Каждая сессия в этом репозитории (s01-s12) реверс-инжинирит один механизм harness из архитектуры Claude Code. К концу вы поймёте не только то, как работает Claude Code, но и универсальные принципы harness-инжиниринга, применимые к любому агенту в любом домене.

Урок не в том, чтобы "копировать Claude Code". Урок в следующем: **лучшие agent-продукты строят инженеры, понимающие, что их работа -- harness, а не интеллект.**

---

## Видение: наполнить вселенную настоящими агентами

Речь не только о кодинг-агентах.

Каждый домен, где люди выполняют сложную, многошаговую работу с интенсивным принятием решений, -- это домен, в котором могут работать агенты, при наличии правильного harness. Шаблоны в этом репозитории универсальны:

```
Estate management agent    = model + property sensors + maintenance tools + tenant comms
Agricultural agent         = model + soil/weather data + irrigation controls + crop knowledge
Hotel operations agent     = model + booking system + guest channels + facility APIs
Medical research agent     = model + literature search + lab instruments + protocol docs
Manufacturing agent        = model + production line sensors + quality controls + logistics
Education agent            = model + curriculum knowledge + student progress + assessment tools
```

Цикл всегда одинаков. Tools меняются. Знания меняются. Permissions меняются. Агент -- модель -- обобщается.

Каждый harness-инженер, читающий этот репозиторий, осваивает шаблоны, применимые далеко за пределами разработки ПО. Вы учитесь строить инфраструктуру для интеллектуального, автоматизированного будущего. Каждый хорошо спроектированный harness, развёрнутый в реальном домене, -- это ещё одно место, где агент может воспринимать, рассуждать и действовать.

Сначала мы заполним мастерские. Потом фермы, больницы, заводы. Потом города. Потом планету.

**Bash is all you need. Real agents are all the universe needs.**

---

```
                    THE AGENT PATTERN
                    =================

    User --> messages[] --> LLM --> response
                                      |
                            stop_reason == "tool_use"?
                           /                          \
                         yes                           no
                          |                             |
                    execute tools                    return text
                    append results
                    loop back -----------------> messages[]


    That's the minimal loop. Every AI agent needs this loop.
    The MODEL decides when to call tools and when to stop.
    The CODE just executes what the model asks for.
    This repo teaches you to build what surrounds this loop --
    the harness that makes the agent effective in a specific domain.
```

**12 последовательных сессий, от простого цикла до изолированного автономного исполнения.**
**Каждая сессия добавляет один механизм harness. У каждого механизма есть свой девиз.**

> **s01** &nbsp; *"One loop & Bash is all you need"* &mdash; один инструмент + один цикл = агент
>
> **s02** &nbsp; *"Adding a tool means adding one handler"* &mdash; цикл остаётся прежним; новые инструменты регистрируются в карте диспетчеризации
>
> **s03** &nbsp; *"An agent without a plan drifts"* &mdash; сначала перечисли шаги, потом выполняй; завершаемость удваивается
>
> **s04** &nbsp; *"Break big tasks down; each subtask gets a clean context"* &mdash; подагенты используют независимый `messages[]`, главный диалог остаётся чистым
>
> **s05** &nbsp; *"Load knowledge when you need it, not upfront"* &mdash; инъекция через `tool_result`, а не через `system_prompt`
>
> **s06** &nbsp; *"Context will fill up; you need a way to make room"* &mdash; трёхуровневая стратегия сжатия для бесконечных сессий
>
> **s07** &nbsp; *"Break big goals into small tasks, order them, persist to disk"* &mdash; файловый граф задач с зависимостями, фундамент для мультиагентного взаимодействия
>
> **s08** &nbsp; *"Run slow operations in the background; the agent keeps thinking"* &mdash; daemon-потоки выполняют команды и инжектят уведомления по завершении
>
> **s09** &nbsp; *"When the task is too big for one, delegate to teammates"* &mdash; постоянные тиммейты + асинхронные mailbox
>
> **s10** &nbsp; *"Teammates need shared communication rules"* &mdash; один паттерн request-response управляет всеми переговорами
>
> **s11** &nbsp; *"Teammates scan the board and claim tasks themselves"* &mdash; ведущему не нужно назначать каждую задачу
>
> **s12** &nbsp; *"Each works in its own directory, no interference"* &mdash; tasks управляют целями, worktrees управляют директориями, связаны по ID

---

## Базовый паттерн

```python
def agent_loop(messages):
    while True:
        response = client.messages.create(
            model=MODEL, system=SYSTEM,
            messages=messages, tools=TOOLS,
        )
        messages.append({"role": "assistant",
                         "content": response.content})

        if response.stop_reason != "tool_use":
            return

        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = TOOL_HANDLERS[block.name](**block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                })
        messages.append({"role": "user", "content": results})
```

Каждая сессия наслаивает один механизм harness поверх этого цикла -- не меняя сам цикл. Цикл принадлежит агенту. Механизмы принадлежат harness.

## Область применения (важно)

Этот репозиторий -- учебный проект 0->1 по harness-инжинирингу: построение среды, окружающей модель агента.
Он намеренно упрощает или опускает несколько production-механизмов:

- Полные шины событий/хуков (например, PreToolUse, SessionStart/End, ConfigChange).
  s12 содержит лишь минимальный append-only поток событий жизненного цикла для учебных целей.
- Управление permissions на основе правил и workflows доверия
- Управление жизненным циклом сессий (resume/fork) и продвинутое управление жизненным циклом worktree
- Полные детали runtime MCP (transport/OAuth/resource subscribe/polling)

Относитесь к JSONL-протоколу командного mailbox в этом репозитории как к учебной реализации, а не как к утверждению о каких-либо конкретных production-внутренностях.

## Быстрый старт

```sh
git clone https://github.com/shareAI-lab/learn-claude-code
cd learn-claude-code
pip install -r requirements.txt
cp .env.example .env   # Edit .env with your ANTHROPIC_API_KEY

python agents/s01_agent_loop.py       # Start here
python agents/s12_worktree_task_isolation.py  # Full progression endpoint
python agents/s_full.py               # Capstone: all mechanisms combined
```

### Веб-платформа

Интерактивные визуализации, пошаговые диаграммы, просмотрщик исходников и документация.

```sh
cd web && npm install && npm run dev   # http://localhost:3000
```

## Маршрут обучения

```
Phase 1: THE LOOP                    Phase 2: PLANNING & KNOWLEDGE
==================                   ==============================
s01  The Agent Loop          [1]     s03  TodoWrite               [5]
     while + stop_reason                  TodoManager + nag reminder
     |                                    |
     +-> s02  Tool Use            [4]     s04  Subagents            [5]
              dispatch map: name->handler     fresh messages[] per child
                                              |
                                         s05  Skills               [5]
                                              SKILL.md via tool_result
                                              |
                                         s06  Context Compact      [5]
                                              3-layer compression

Phase 3: PERSISTENCE                 Phase 4: TEAMS
==================                   =====================
s07  Tasks                   [8]     s09  Agent Teams             [9]
     file-based CRUD + deps graph         teammates + JSONL mailboxes
     |                                    |
s08  Background Tasks        [6]     s10  Team Protocols          [12]
     daemon threads + notify queue        shutdown + plan approval FSM
                                          |
                                     s11  Autonomous Agents       [14]
                                          idle cycle + auto-claim
                                     |
                                     s12  Worktree Isolation      [16]
                                          task coordination + optional isolated execution lanes

                                     [N] = number of tools
```

## Архитектура

```
learn-claude-code/
|
|-- agents/                        # Python reference implementations (s01-s12 + s_full capstone)
|-- docs/                          # Mental-model-first documentation (3 languages)
|-- web/                           # Interactive learning platform (Next.js)
|-- skills/                        # Skill files for s05
+-- .github/workflows/ci.yml      # CI: typecheck + build
```

## Документация

Сначала ментальная модель: проблема, решение, ASCII-диаграмма, минимальный код.

| Сессия | Тема | Девиз |
|---------|-------|-------|
| [s01](./docs/en/s01-the-agent-loop.md) | The Agent Loop | *One loop & Bash is all you need* |
| [s02](./docs/en/s02-tool-use.md) | Tool Use | *Adding a tool means adding one handler* |
| [s03](./docs/en/s03-todo-write.md) | TodoWrite | *An agent without a plan drifts* |
| [s04](./docs/en/s04-subagent.md) | Subagents | *Break big tasks down; each subtask gets a clean context* |
| [s05](./docs/en/s05-skill-loading.md) | Skills | *Load knowledge when you need it, not upfront* |
| [s06](./docs/en/s06-context-compact.md) | Context Compact | *Context will fill up; you need a way to make room* |
| [s07](./docs/en/s07-task-system.md) | Tasks | *Break big goals into small tasks, order them, persist to disk* |
| [s08](./docs/en/s08-background-tasks.md) | Background Tasks | *Run slow operations in the background; the agent keeps thinking* |
| [s09](./docs/en/s09-agent-teams.md) | Agent Teams | *When the task is too big for one, delegate to teammates* |
| [s10](./docs/en/s10-team-protocols.md) | Team Protocols | *Teammates need shared communication rules* |
| [s11](./docs/en/s11-autonomous-agents.md) | Autonomous Agents | *Teammates scan the board and claim tasks themselves* |
| [s12](./docs/en/s12-worktree-task-isolation.md) | Worktree + Task Isolation | *Each works in its own directory, no interference* |

## Что дальше -- от понимания к запуску
После 12 сессий вы понимаете, как harness-инжиниринг работает изнутри. 

## Лицензия

MIT

---

**Агентность исходит из модели. Harness делает агентность реальной. Стройте отличные harness. Остальное сделает модель.**

**Bash is all you need. Real agents are all the universe needs.**
