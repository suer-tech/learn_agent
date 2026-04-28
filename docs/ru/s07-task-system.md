# s07: Система задач

`s01 > s02 > s03 > s04 > s05 > s06 | [ s07 ] s08 > s09 > s10 > s11 > s12`

> *"Разбивай большие цели на маленькие задачи, упорядочивай их и сохраняй на диск"* -- файловый граф задач с зависимостями, закладывающий основу для коллаборации нескольких агентов.
>
> **Слой harness**: Постоянные задачи -- цели, которые переживают любой отдельный диалог.

## Проблема

`TodoManager` из s03 -- это плоский чек-лист в памяти: без упорядочивания, без зависимостей, без статусов кроме «сделано/не сделано». Реальные цели имеют структуру -- задача B зависит от A, задачи C и D могут выполняться параллельно, задача E ждёт и C, и D.

Без явных связей агент не может определить, что готово к работе, что заблокировано и что можно запускать одновременно. А поскольку список живёт только в памяти, сжатие контекста (s06) полностью его стирает.

## Решение

Превратить чек-лист в граф задач, лежащий на диске: каждая задача — отдельный JSON-файл со статусом `pending → in_progress → completed` и списком `blockedBy`. По этой структуре граф в любой момент отвечает, что готово к работе, что заблокировано и что уже сделано, а завершение задачи автоматически вычёркивает её ID из зависимостей других. Поскольку состояние живёт в файлах, оно переживает сжатие контекста и перезапуск процесса — и становится общим каркасом координации для фоновых задач, команд агентов и worktree в следующих главах.

## Как это работает

1. **TaskManager**: один JSON-файл на задачу, CRUD с графом зависимостей.

```python
class TaskManager:
    def __init__(self, tasks_dir: Path):
        self.dir = tasks_dir
        self.dir.mkdir(exist_ok=True)
        self._next_id = self._max_id() + 1

    def create(self, subject, description=""):
        task = {"id": self._next_id, "subject": subject,
                "status": "pending", "blockedBy": [],
                "owner": ""}
        self._save(task)
        self._next_id += 1
        return json.dumps(task, indent=2)
```

2. **Разрешение зависимостей**: завершение задачи удаляет её ID из списка `blockedBy` всех остальных задач, автоматически разблокируя зависимых.

```python
def _clear_dependency(self, completed_id):
    for f in self.dir.glob("task_*.json"):
        task = json.loads(f.read_text())
        if completed_id in task.get("blockedBy", []):
            task["blockedBy"].remove(completed_id)
            self._save(task)
```

3. **Обвязка статусов и зависимостей**: `update` управляет переходами и рёбрами зависимостей.

```python
def update(self, task_id, status=None,
           add_blocked_by=None, remove_blocked_by=None):
    task = self._load(task_id)
    if status:
        task["status"] = status
        if status == "completed":
            self._clear_dependency(task_id)
    if add_blocked_by:
        task["blockedBy"] = list(set(task["blockedBy"] + add_blocked_by))
    if remove_blocked_by:
        task["blockedBy"] = [x for x in task["blockedBy"] if x not in remove_blocked_by]
    self._save(task)
```

4. Четыре инструмента работы с задачами добавляются в карту диспетчеризации.

```python
TOOL_HANDLERS = {
    # ...base tools...
    "task_create": lambda **kw: TASKS.create(kw["subject"]),
    "task_update": lambda **kw: TASKS.update(kw["task_id"], kw.get("status")),
    "task_list":   lambda **kw: TASKS.list_all(),
    "task_get":    lambda **kw: TASKS.get(kw["task_id"]),
}
```

Начиная с s07, граф задач становится механизмом по умолчанию для многоэтапной работы. `Todo` из s03 остаётся для быстрых односессионных чек-листов.

## Что изменилось по сравнению с s06

| Компонент | До (s06) | После (s07) |
|---|---|---|
| Инструменты | 5 | 8 (`task_create/update/list/get`) |
| Модель планирования | Плоский чек-лист (в памяти) | Граф задач с зависимостями (на диске) |
| Связи | Нет | Рёбра `blockedBy` |
| Отслеживание статусов | Сделано или нет | `pending` -> `in_progress` -> `completed` |
| Долговечность | Теряется при сжатии | Переживает сжатие и перезапуски |

## Попробуй

```sh
cd learn-claude-code
python agents/s07_task_system.py
```

1. `Создай 3 задачи: "Setup project", "Write code", "Write tests". Свяжи их зависимостями по порядку.`
2. `Перечисли все задачи и покажи граф зависимостей`
3. `Заверши задачу 1, затем перечисли задачи и убедись, что задача 2 разблокирована`
4. `Сделай доску задач для рефакторинга: parse -> transform -> emit -> test, где transform и emit могут идти параллельно после parse`
