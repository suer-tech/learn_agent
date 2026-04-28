# s04: Подагенты

`s01 > s02 > s03 > [ s04 ] s05 > s06 | s07 > s08 > s09 > s10 > s11 > s12`

> *"Break big tasks down; each subtask gets a clean context"* -- подагенты используют независимый `messages[]`, сохраняя основной диалог чистым.
>
> **Слой harness**: Изоляция контекста -- защита ясности мысли модели.

## Проблема

По мере работы агента его массив messages растёт. Каждое прочтение файла, каждый вывод bash остаётся в контексте навсегда. «Какой фреймворк для тестирования использует этот проект?» может потребовать чтения 5 файлов, но родителю нужен только ответ: "pytest".

## Решение

Дать родителю инструмент `task`, который запускает дочерний агент со свежим `messages=[]` и собственным циклом. Подагент сам читает файлы, гоняет команды и собирает контекст, а к родителю возвращает только финальный текстовый ответ — как обычный `tool_result`. Десятки шагов исследования схлопываются в один абзац, и основной диалог не разбухает от промежуточного шума.

## Как это работает

1. Родитель получает инструмент `task`. Ребёнок получает все базовые инструменты, кроме `task` (никакого рекурсивного порождения).

```python
PARENT_TOOLS = CHILD_TOOLS + [
    {"name": "task",
     "description": "Spawn a subagent with fresh context.",
     "input_schema": {
         "type": "object",
         "properties": {"prompt": {"type": "string"}},
         "required": ["prompt"],
     }},
]
```

2. Подагент стартует с `messages=[]` и крутит свой собственный цикл. К родителю возвращается только финальный текст.

```python
def run_subagent(prompt: str) -> str:
    sub_messages = [{"role": "user", "content": prompt}]
    for _ in range(30):  # safety limit
        response = client.messages.create(
            model=MODEL, system=SUBAGENT_SYSTEM,
            messages=sub_messages,
            tools=CHILD_TOOLS, max_tokens=8000,
        )
        sub_messages.append({"role": "assistant",
                             "content": response.content})
        if response.stop_reason != "tool_use":
            break
        results = []
        for block in response.content:
            if block.type == "tool_use":
                handler = TOOL_HANDLERS.get(block.name)
                output = handler(**block.input)
                results.append({"type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(output)[:50000]})
        sub_messages.append({"role": "user", "content": results})
    return "".join(
        b.text for b in response.content if hasattr(b, "text")
    ) or "(no summary)"
```

Вся история сообщений ребёнка (возможно, 30+ вызовов инструментов) выбрасывается. Родитель получает резюме в один абзац как обычный `tool_result`.

## Что изменилось по сравнению с s03

| Компонент      | До (s03)         | После (s04)                  |
|----------------|------------------|------------------------------|
| Инструменты    | 5                | 5 (база) + task (родитель)   |
| Контекст       | Один общий       | Изоляция родителя и ребёнка  |
| Подагент       | Нет              | Функция `run_subagent()`     |
| Возвращаемое значение | N/A       | Только текст резюме          |

## Попробуйте

```sh
cd learn_agent
python agents/s04_subagent.py
```

1. `Через подзадачу выясни, какой фреймворк для тестирования использует этот проект`
2. `Делегируй: прочитай все .py-файлы и резюмируй, что делает каждый`
3. `Через task создай новый модуль, а затем проверь его отсюда`
