# s02: Использование инструментов

`s01 > [ s02 ] s03 > s04 > s05 > s06 | s07 > s08 > s09 > s10 > s11 > s12`

> *"Adding a tool means adding one handler"* -- цикл остаётся прежним; новые инструменты регистрируются в карте диспетчеризации.
>
> **Слой harness**: Диспетчеризация инструментов -- расширение того, до чего модель может дотянуться.

## Проблема

Имея только `bash`, агент уходит в shell для всего. `cat` непредсказуемо обрезает вывод, `sed` ломается на спецсимволах, и каждый вызов bash -- это бесконтрольная поверхность атаки. Специализированные инструменты вроде `read_file` и `write_file` позволяют обеспечить песочницу путей на уровне инструмента.

Ключевая идея: добавление инструментов не требует изменения цикла.

## Решение

Заменить всемогущий `bash` на словарь `{имя_инструмента: обработчик}`, по которому цикл диспетчеризует каждый `tool_use`. Каждый специализированный инструмент (`read_file`, `write_file`, `edit_file`) получает собственный обработчик с песочницей путей, так что побег из workspace становится невозможен на уровне реализации. Добавить новый инструмент — это добавить запись в словарь и схему; сам цикл из s01 не меняется.

## Как это работает

1. Каждый инструмент получает функцию-обработчик. Песочница путей не даёт сбежать из workspace.

```python
def safe_path(p: str) -> Path:
    path = (WORKDIR / p).resolve()
    if not path.is_relative_to(WORKDIR):
        raise ValueError(f"Path escapes workspace: {p}")
    return path

def run_read(path: str, limit: int = None) -> str:
    text = safe_path(path).read_text()
    lines = text.splitlines()
    if limit and limit < len(lines):
        lines = lines[:limit]
    return "\n".join(lines)[:50000]
```

2. Карта диспетчеризации связывает имена инструментов с обработчиками.

```python
TOOL_HANDLERS = {
    "bash":       lambda **kw: run_bash(kw["command"]),
    "read_file":  lambda **kw: run_read(kw["path"], kw.get("limit")),
    "write_file": lambda **kw: run_write(kw["path"], kw["content"]),
    "edit_file":  lambda **kw: run_edit(kw["path"], kw["old_text"],
                                        kw["new_text"]),
}
```

3. Внутри цикла находим обработчик по имени. Тело самого цикла не изменилось со времён s01.

```python
for block in response.content:
    if block.type == "tool_use":
        handler = TOOL_HANDLERS.get(block.name)
        output = handler(**block.input) if handler \
            else f"Unknown tool: {block.name}"
        results.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": output,
        })
```

Добавить инструмент = добавить обработчик + добавить запись в схему. Цикл никогда не меняется.

## Что изменилось по сравнению с s01

| Компонент      | До (s01)            | После (s02)                |
|----------------|---------------------|----------------------------|
| Инструменты    | 1 (только bash)     | 4 (bash, read, write, edit)|
| Диспетчеризация| Жёстко зашитый bash | dict `TOOL_HANDLERS`       |
| Безопасность путей | Нет             | Песочница `safe_path()`    |
| Цикл агента    | Без изменений       | Без изменений              |

## Попробуйте

```sh
cd learn-claude-code
python agents/s02_tool_use.py
```

1. `Прочитай файл requirements.txt`
2. `Создай файл greet.py с функцией greet(name)`
3. `Отредактируй greet.py, добавив docstring к функции`
4. `Прочитай greet.py, чтобы убедиться, что правка применилась`
