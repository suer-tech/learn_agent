# s09: Команды агентов

`s01 > s02 > s03 > s04 > s05 > s06 | s07 > s08 > [ s09 ] s10 > s11 > s12`

> *"Когда задача слишком велика для одного, делегируй тиммейтам"* -- постоянные тиммейты + асинхронные почтовые ящики.
>
> **Слой harness**: Командные почтовые ящики -- несколько моделей, координирующихся через файлы.

## Проблема

Подагенты (s04) одноразовы: запустился, поработал, вернул сводку, умер. Ни идентичности, ни памяти между вызовами. Фоновые задачи (s08) выполняют shell-команды, но не могут принимать решения под управлением LLM.

Настоящая командная работа требует: (1) постоянных агентов, переживающих один промпт, (2) управления идентичностью и жизненным циклом, (3) канала связи между агентами.

## Решение

Сделать тиммейтов постоянными процессами: `TeammateManager` хранит состав команды в `config.json` и запускает каждого в отдельном потоке с собственным циклом агента. Связь идёт через файловые почтовые ящики `inbox/<имя>.jsonl` — `send()` дописывает строку JSON, `read_inbox()` читает всё разом и очищает файл. Каждый тиммейт перед очередным вызовом LLM проверяет свой ящик и подмешивает новые сообщения в контекст, так что несколько моделей координируются асинхронно через диск.

## Как это работает

1. `TeammateManager` поддерживает `config.json` со списком команды.

```python
class TeammateManager:
    def __init__(self, team_dir: Path):
        self.dir = team_dir
        self.dir.mkdir(exist_ok=True)
        self.config_path = self.dir / "config.json"
        self.config = self._load_config()
        self.threads = {}
```

2. `spawn()` создаёт тиммейта и запускает его цикл агента в потоке.

```python
def spawn(self, name: str, role: str, prompt: str) -> str:
    member = {"name": name, "role": role, "status": "working"}
    self.config["members"].append(member)
    self._save_config()
    thread = threading.Thread(
        target=self._teammate_loop,
        args=(name, role, prompt), daemon=True)
    thread.start()
    return f"Spawned teammate '{name}' (role: {role})"
```

3. `MessageBus`: входящие в виде append-only JSONL. `send()` дописывает JSON-строку; `read_inbox()` читает всё и очищает ящик.

```python
class MessageBus:
    def send(self, sender, to, content, msg_type="message", extra=None):
        msg = {"type": msg_type, "from": sender,
               "content": content, "timestamp": time.time()}
        if extra:
            msg.update(extra)
        with open(self.dir / f"{to}.jsonl", "a") as f:
            f.write(json.dumps(msg) + "\n")

    def read_inbox(self, name):
        path = self.dir / f"{name}.jsonl"
        if not path.exists(): return "[]"
        msgs = [json.loads(l) for l in path.read_text().strip().splitlines() if l]
        path.write_text("")  # drain
        return json.dumps(msgs, indent=2)
```

4. Каждый тиммейт перед каждым вызовом LLM проверяет свои входящие, добавляя полученные сообщения в контекст.

```python
def _teammate_loop(self, name, role, prompt):
    messages = [{"role": "user", "content": prompt}]
    for _ in range(50):
        inbox = BUS.read_inbox(name)
        if inbox != "[]":
            messages.append({"role": "user",
                "content": f"<inbox>{inbox}</inbox>"})
        response = client.messages.create(...)
        if response.stop_reason != "tool_use":
            break
        # execute tools, append results...
    self._find_member(name)["status"] = "idle"
```

## Что изменилось по сравнению с s08

| Компонент      | До (s08)         | После (s09)                |
|----------------|------------------|----------------------------|
| Инструменты    | 6                | 9 (+spawn/send/read_inbox) |
| Агенты         | Один             | Ведущий + N тиммейтов      |
| Долговечность  | Нет              | `config.json` + JSONL-входящие |
| Потоки         | Фоновые команды  | Полноценные циклы агента в каждом потоке |
| Жизненный цикл | Fire-and-forget  | idle -> working -> idle    |
| Коммуникация   | Нет              | сообщение + broadcast      |

## Попробуй

```sh
cd learn-claude-code
python agents/s09_agent_teams.py
```

1. `Запусти alice (coder) и bob (tester). Пусть alice отправит bob сообщение.`
2. `Сделай broadcast "status update: phase 1 complete" всем тиммейтам`
3. `Проверь входящие ведущего на новые сообщения`
4. Введи `/team`, чтобы увидеть состав команды и статусы
5. Введи `/inbox`, чтобы вручную проверить входящие ведущего
