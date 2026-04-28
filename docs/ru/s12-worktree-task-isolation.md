# s12: Worktree + изоляция задач

`s01 > s02 > s03 > s04 > s05 > s06 | s07 > s08 > s09 > s10 > s11 > [ s12 ]`

> *"Каждый работает в своей директории, никто никому не мешает"* -- задачи управляют целями, worktree управляют директориями, связаны через ID.
>
> **Слой harness**: Изоляция директорий -- параллельные дорожки выполнения, которые никогда не сталкиваются.

## Проблема

К моменту s11 агенты умеют автономно брать и завершать задачи. Но каждая задача выполняется в одной общей директории. Два агента, рефакторящие разные модули одновременно, столкнутся: агент A правит `config.py`, агент B правит `config.py`, незакоммиченные изменения смешиваются, и ни один из них не может чисто откатиться.

Доска задач отслеживает *что делать*, но ничего не говорит о том, *где это делать*. Решение: дать каждой задаче свою git-worktree-директорию. Задачи управляют целями, worktree управляют контекстом выполнения. Связываем их по ID задачи.

## Решение

Разделить плоскости управления и выполнения: задачи в `.tasks/` отвечают на вопрос «что делать», а git-worktree в `.worktrees/` — «где это делать». Каждой задаче выделяется собственная директория с отдельной веткой, и `task_id` связывает их в обе стороны: связывание автоматически переводит задачу в `in_progress`, а удаление worktree с `complete_task=true` завершает задачу одним вызовом. Все изменения жизненного цикла попадают в `events.jsonl`, поэтому состояние можно восстановить с диска после сбоя — параллельные дорожки выполнения не сталкиваются ни в файлах, ни в ветках.

## Как это работает

1. **Создаём задачу.** Сначала фиксируем цель.

```python
TASKS.create("Implement auth refactor")
# -> .tasks/task_1.json  status=pending  worktree=""
```

2. **Создаём worktree и связываем с задачей.** Передача `task_id` автоматически переводит задачу в `in_progress`.

```python
WORKTREES.create("auth-refactor", task_id=1)
# -> git worktree add -b wt/auth-refactor .worktrees/auth-refactor HEAD
# -> index.json gets new entry, task_1.json gets worktree="auth-refactor"
```

Связывание записывает состояние с обеих сторон:

```python
def bind_worktree(self, task_id, worktree):
    task = self._load(task_id)
    task["worktree"] = worktree
    if task["status"] == "pending":
        task["status"] = "in_progress"
    self._save(task)
```

3. **Запускаем команды в worktree.** `cwd` указывает на изолированную директорию.

```python
subprocess.run(command, shell=True, cwd=worktree_path,
               capture_output=True, text=True, timeout=300)
```

4. **Закрываем.** Два варианта:
   - `worktree_keep(name)` -- сохранить директорию для дальнейшего использования.
   - `worktree_remove(name, complete_task=True)` -- удалить директорию, завершить связанную задачу, испустить событие. Один вызов делает и teardown, и завершение.

```python
def remove(self, name, force=False, complete_task=False):
    self._run_git(["worktree", "remove", wt["path"]])
    if complete_task and wt.get("task_id") is not None:
        self.tasks.update(wt["task_id"], status="completed")
        self.tasks.unbind_worktree(wt["task_id"])
        self.events.emit("task.completed", ...)
```

5. **Поток событий.** Каждый шаг жизненного цикла пишется в `.worktrees/events.jsonl`:

```json
{
  "event": "worktree.remove.after",
  "task": {"id": 1, "status": "completed"},
  "worktree": {"name": "auth-refactor", "status": "removed"},
  "ts": 1730000000
}
```

Испускаемые события: `worktree.create.before/after/failed`, `worktree.remove.before/after/failed`, `worktree.keep`, `task.completed`.

После сбоя состояние реконструируется с диска из `.tasks/` + `.worktrees/index.json`. Память диалога летучая, файловое состояние -- долговечное.

## Что изменилось по сравнению с s11

| Компонент          | До (s11)                   | После (s12)                                  |
|--------------------|----------------------------|----------------------------------------------|
| Координация        | Доска задач (владелец/статус) | Доска задач + явная привязка worktree     |
| Область выполнения | Общая директория           | Изолированная директория под задачу          |
| Восстановимость    | Только статус задачи       | Статус задачи + индекс worktree              |
| Teardown           | Завершение задачи          | Завершение задачи + явный keep/remove        |
| Видимость жизненного цикла | Неявно в логах     | Явные события в `.worktrees/events.jsonl`    |

## Попробуй

```sh
cd learn_agent
python agents/s12_worktree_task_isolation.py
```

1. `Создай задачи для backend-авторизации и frontend-страницы входа, затем перечисли задачи.`
2. `Создай worktree "auth-refactor" для задачи 1, затем привяжи задачу 2 к новому worktree "ui-login".`
3. `Запусти "git status --short" в worktree "auth-refactor".`
4. `Сохрани worktree "ui-login", затем перечисли worktree и просмотри события.`
5. `Удали worktree "auth-refactor" c complete_task=true, затем перечисли задачи/worktree/события.`
