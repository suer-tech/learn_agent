# s11: Автономные агенты

`s01 > s02 > s03 > s04 > s05 > s06 | s07 > s08 > s09 > s10 > [ s11 ] s12`

> *"Тиммейты сами сканируют доску и берут задачи"* -- ведущему не нужно назначать каждую вручную.
>
> **Слой harness**: Автономия -- модели, которые сами находят работу.

## Проблема

В s09-s10 тиммейты работают только тогда, когда им явно сказано. Ведущий должен запустить каждого с конкретным промптом. На доске 10 неразобранных задач? Ведущий назначает каждую вручную. Это не масштабируется.

Настоящая автономия: тиммейты сами сканируют доску задач, берут невзятые задачи, выполняют их, потом ищут ещё.

Один нюанс: после сжатия контекста (s06) агент может забыть, кто он. Повторная инъекция идентичности решает эту проблему.

## Решение

Добавить тиммейту фазу IDLE: когда модель перестаёт вызывать инструменты или явно вызывает `idle`, агент уходит в опрос — каждые 5 секунд проверяет входящие и сканирует доску `.tasks/` на неразобранные задачи без блокировок. Если что-то нашлось, тиммейт сам присваивает себе задачу и возвращается в WORK; иначе по таймауту в 60 секунд завершается. Чтобы пережить сжатие контекста, агент заодно проверяет, не стал ли его `messages` подозрительно коротким, и в этом случае повторно вставляет блок идентичности — кто он и в какой команде работает.

## Как это работает

1. Цикл тиммейта имеет две фазы: WORK и IDLE. Когда LLM перестаёт вызывать инструменты (или вызывает `idle`), тиммейт переходит в IDLE.

```python
def _loop(self, name, role, prompt):
    while True:
        # -- WORK PHASE --
        messages = [{"role": "user", "content": prompt}]
        for _ in range(50):
            response = client.messages.create(...)
            if response.stop_reason != "tool_use":
                break
            # execute tools...
            if idle_requested:
                break

        # -- IDLE PHASE --
        self._set_status(name, "idle")
        resume = self._idle_poll(name, messages)
        if not resume:
            self._set_status(name, "shutdown")
            return
        self._set_status(name, "working")
```

2. Фаза idle опрашивает входящие и доску задач в цикле.

```python
def _idle_poll(self, name, messages):
    for _ in range(IDLE_TIMEOUT // POLL_INTERVAL):  # 60s / 5s = 12
        time.sleep(POLL_INTERVAL)
        inbox = BUS.read_inbox(name)
        if inbox:
            messages.append({"role": "user",
                "content": f"<inbox>{inbox}</inbox>"})
            return True
        unclaimed = scan_unclaimed_tasks()
        if unclaimed:
            claim_task(unclaimed[0]["id"], name)
            messages.append({"role": "user",
                "content": f"<auto-claimed>Task #{unclaimed[0]['id']}: "
                           f"{unclaimed[0]['subject']}</auto-claimed>"})
            return True
    return False  # timeout -> shutdown
```

3. Сканирование доски задач: ищем `pending`-задачи без владельца и без блокировок.

```python
def scan_unclaimed_tasks() -> list:
    unclaimed = []
    for f in sorted(TASKS_DIR.glob("task_*.json")):
        task = json.loads(f.read_text())
        if (task.get("status") == "pending"
                and not task.get("owner")
                and not task.get("blockedBy")):
            unclaimed.append(task)
    return unclaimed
```

4. Повторная инъекция идентичности: если контекст слишком короткий (произошло сжатие), вставляем блок с идентичностью.

```python
if len(messages) <= 3:
    messages.insert(0, {"role": "user",
        "content": f"<identity>You are '{name}', role: {role}, "
                   f"team: {team_name}. Continue your work.</identity>"})
    messages.insert(1, {"role": "assistant",
        "content": f"I am {name}. Continuing."})
```

## Что изменилось по сравнению с s10

| Компонент      | До (s10)         | После (s11)                |
|----------------|------------------|----------------------------|
| Инструменты    | 12               | 14 (+idle, +claim_task)    |
| Автономия      | Под управлением ведущего | Самоорганизация    |
| Фаза idle      | Нет              | Опрос входящих и доски задач |
| Взятие задач   | Только вручную   | Авто-взятие невзятых задач |
| Идентичность   | Системный промпт | + повторная инъекция после сжатия |
| Таймаут        | Нет              | 60с idle -> авто-завершение |

## Попробуй

```sh
cd learn_agent
python agents/s11_autonomous_agents.py
```

1. `Создай 3 задачи на доске, затем запусти alice и bob. Посмотри, как они сами их разбирают.`
2. `Запусти тиммейта-кодера и позволь ему самому находить работу с доски задач`
3. `Создай задачи с зависимостями. Посмотри, как тиммейты соблюдают порядок блокировок.`
4. Введи `/tasks`, чтобы увидеть доску задач с владельцами
5. Введи `/team`, чтобы отслеживать, кто работает, а кто простаивает
