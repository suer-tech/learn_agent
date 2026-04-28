# s06: Сжатие контекста

`s01 > s02 > s03 > s04 > s05 > [ s06 ] | s07 > s08 > s09 > s10 > s11 > s12`

> *"Context will fill up; you need a way to make room"* -- трёхслойная стратегия сжатия для бесконечных сессий.
>
> **Слой harness**: Сжатие -- чистая память для бесконечных сессий.

## Проблема

Окно контекста конечно. Один `read_file` для файла в 1000 строк стоит ~4000 токенов. После прочтения 30 файлов и запуска 20 bash-команд вы упираетесь в 100000+ токенов. Агент не может работать на больших кодовых базах без сжатия.

## Решение

Сжимать в три слоя по нарастающей агрессивности. На каждом шаге `micro_compact` тихо заменяет старые `tool_result` плейсхолдерами, освобождая основную часть токенов. Когда оценка токенов всё-таки переваливает за порог, срабатывает `auto_compact`: полный транскрипт пишется на диск, а LLM резюмирует диалог в одно сообщение, которое заменяет всю историю. Третий слой — инструмент `compact`, который модель может вызвать сама, когда чувствует, что контекст пора сжать.

## Как это работает

1. **Слой 1 -- `micro_compact`**: Перед каждым вызовом LLM заменяем старые результаты инструментов на плейсхолдеры.

```python
def micro_compact(messages: list) -> list:
    tool_results = []
    for i, msg in enumerate(messages):
        if msg["role"] == "user" and isinstance(msg.get("content"), list):
            for j, part in enumerate(msg["content"]):
                if isinstance(part, dict) and part.get("type") == "tool_result":
                    tool_results.append((i, j, part))
    if len(tool_results) <= KEEP_RECENT:
        return messages
    for _, _, part in tool_results[:-KEEP_RECENT]:
        if len(part.get("content", "")) > 100:
            part["content"] = f"[Previous: used {tool_name}]"
    return messages
```

2. **Слой 2 -- `auto_compact`**: Когда количество токенов превышает порог, сохраняем полный транскрипт на диск, затем просим LLM сделать резюме.

```python
def auto_compact(messages: list) -> list:
    # Save transcript for recovery
    transcript_path = TRANSCRIPT_DIR / f"transcript_{int(time.time())}.jsonl"
    with open(transcript_path, "w") as f:
        for msg in messages:
            f.write(json.dumps(msg, default=str) + "\n")
    # LLM summarizes
    response = client.messages.create(
        model=MODEL,
        messages=[{"role": "user", "content":
            "Summarize this conversation for continuity..."
            + json.dumps(messages, default=str)[:80000]}],
        max_tokens=2000,
    )
    return [
        {"role": "user", "content": f"[Compressed]\n\n{response.content[0].text}"},
    ]
```

3. **Слой 3 -- ручное сжатие**: Инструмент `compact` запускает то же самое резюмирование по требованию.

4. Цикл интегрирует все три слоя:

```python
def agent_loop(messages: list):
    while True:
        micro_compact(messages)                        # Layer 1
        if estimate_tokens(messages) > THRESHOLD:
            messages[:] = auto_compact(messages)       # Layer 2
        response = client.messages.create(...)
        # ... tool execution ...
        if manual_compact:
            messages[:] = auto_compact(messages)       # Layer 3
```

Транскрипты сохраняют полную историю на диске. Ничто на самом деле не теряется -- всё лишь выносится из активного контекста.

## Что изменилось по сравнению с s05

| Компонент       | До (s05)         | После (s06)                |
|-----------------|------------------|----------------------------|
| Инструменты     | 5                | 5 (база + compact)         |
| Управление контекстом | Нет        | Трёхслойное сжатие         |
| Micro-compact   | Нет              | Старые результаты -> плейсхолдеры |
| Auto-compact    | Нет              | Срабатывает по порогу токенов |
| Транскрипты     | Нет              | Сохраняются в .transcripts/ |

## Попробуйте

```sh
cd learn_agent
python agents/s06_context_compact.py
```

1. `Читай все Python-файлы в директории agents/ один за другим` (наблюдайте, как micro-compact заменяет старые результаты)
2. `Продолжай читать файлы, пока сжатие не сработает автоматически`
3. `Используй инструмент compact, чтобы вручную сжать диалог`
