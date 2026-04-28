# s03: TodoWrite

`s01 > s02 > [ s03 ] s04 > s05 > s06 | s07 > s08 > s09 > s10 > s11 > s12`

> *"An agent without a plan drifts"* -- сначала перечисли шаги, потом выполняй.
>
> **Слой harness**: Планирование -- удержание модели на курсе без жёсткого скриптования маршрута.

## Проблема

В многошаговых задачах модель теряет нить. Она повторяет работу, пропускает шаги или уходит в сторону. Длинные диалоги усугубляют это -- системный промпт растворяется по мере того, как результаты инструментов заполняют контекст. Рефакторинг из 10 шагов может выполнить шаги 1-3, а затем модель начинает импровизировать, потому что забыла шаги 4-10.

## Решение

Дать модели инструмент `todo`, привязанный к `TodoManager`, который хранит явный список шагов и не позволяет держать больше одной задачи в статусе `in_progress` одновременно. Если модель пропустила 3+ раунда без обновления списка, harness впрыскивает `<reminder>` в очередной `tool_result`, возвращая её к плану. Так список шагов остаётся видимым в контексте, а ограничение «один in_progress» принуждает к последовательному фокусу.

## Как это работает

1. `TodoManager` хранит элементы со статусами. Только один элемент может быть `in_progress` одновременно.

```python
class TodoManager:
    def update(self, items: list) -> str:
        validated, in_progress_count = [], 0
        for item in items:
            status = item.get("status", "pending")
            if status == "in_progress":
                in_progress_count += 1
            validated.append({"id": item["id"], "text": item["text"],
                              "status": status})
        if in_progress_count > 1:
            raise ValueError("Only one task can be in_progress")
        self.items = validated
        return self.render()
```

2. Инструмент `todo` встаёт в карту диспетчеризации как любой другой инструмент.

```python
TOOL_HANDLERS = {
    # ...base tools...
    "todo": lambda **kw: TODO.update(kw["items"]),
}
```

3. Напоминание-«пиление» подталкивает модель, если она прошла 3+ раунда без вызова `todo`.

```python
if rounds_since_todo >= 3 and messages:
    last = messages[-1]
    if last["role"] == "user" and isinstance(last.get("content"), list):
        last["content"].insert(0, {
            "type": "text",
            "text": "<reminder>Update your todos.</reminder>",
        })
```

Ограничение «один in_progress за раз» принуждает к последовательному фокусу. Напоминание-«пиление» создаёт ответственность.

## Что изменилось по сравнению с s02

| Компонент       | До (s02)         | После (s03)                |
|-----------------|------------------|----------------------------|
| Инструменты     | 4                | 5 (+todo)                  |
| Планирование    | Нет              | TodoManager со статусами   |
| Инъекция «пиления» | Нет           | `<reminder>` после 3 раундов |
| Цикл агента     | Простая диспетчеризация | + счётчик rounds_since_todo |

## Попробуйте

```sh
cd learn-claude-code
python agents/s03_todo_write.py
```

1. `Отрефактори файл hello.py: добавь аннотации типов, docstring-и и main-guard`
2. `Создай Python-пакет с __init__.py, utils.py и tests/test_utils.py`
3. `Просмотри все Python-файлы и исправь стилевые проблемы`
