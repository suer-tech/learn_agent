# s08: Фоновые задачи

`s01 > s02 > s03 > s04 > s05 > s06 | s07 > [ s08 ] s09 > s10 > s11 > s12`

> *"Запускай медленные операции в фоне; агент продолжает думать"* -- демон-потоки выполняют команды и впрыскивают уведомления по завершении.
>
> **Слой harness**: Фоновое выполнение -- модель думает, пока harness ждёт.

## Проблема

Некоторые команды занимают минуты: `npm install`, `pytest`, `docker build`. С блокирующим циклом модель простаивает в ожидании. Если пользователь говорит «установи зависимости и пока они ставятся, создай конфиг», агент сделает это последовательно, а не параллельно.

## Решение

Запускать долгие команды в демон-потоке: `BackgroundManager.run()` мгновенно возвращает идентификатор задачи, а сам подпроцесс работает параллельно. Когда он завершается, результат попадает в потокобезопасную очередь уведомлений. Перед каждым следующим вызовом LLM цикл агента вычитывает очередь и подмешивает свежие результаты в `messages` как блок `<background-results>`. Сам цикл остаётся однопоточным — параллелится только I/O.

## Как это работает

1. `BackgroundManager` отслеживает задачи через потокобезопасную очередь уведомлений.

```python
class BackgroundManager:
    def __init__(self):
        self.tasks = {}
        self._notification_queue = []
        self._lock = threading.Lock()
```

2. `run()` запускает демон-поток и сразу возвращается.

```python
def run(self, command: str) -> str:
    task_id = str(uuid.uuid4())[:8]
    self.tasks[task_id] = {"status": "running", "command": command}
    thread = threading.Thread(
        target=self._execute, args=(task_id, command), daemon=True)
    thread.start()
    return f"Background task {task_id} started"
```

3. Когда подпроцесс завершается, его результат попадает в очередь уведомлений.

```python
def _execute(self, task_id, command):
    try:
        r = subprocess.run(command, shell=True, cwd=WORKDIR,
            capture_output=True, text=True, timeout=300)
        output = (r.stdout + r.stderr).strip()[:50000]
    except subprocess.TimeoutExpired:
        output = "Error: Timeout (300s)"
    with self._lock:
        self._notification_queue.append({
            "task_id": task_id, "result": output[:500]})
```

4. Цикл агента вычитывает уведомления перед каждым вызовом LLM.

```python
def agent_loop(messages: list):
    while True:
        notifs = BG.drain_notifications()
        if notifs:
            notif_text = "\n".join(
                f"[bg:{n['task_id']}] {n['result']}" for n in notifs)
            messages.append({"role": "user",
                "content": f"<background-results>\n{notif_text}\n"
                           f"</background-results>"})
        response = client.messages.create(...)
```

Сам цикл остаётся однопоточным. Параллелится только I/O подпроцессов.

## Что изменилось по сравнению с s07

| Компонент      | До (s07)         | После (s08)                |
|----------------|------------------|----------------------------|
| Инструменты    | 8                | 6 (base + background_run + check)|
| Выполнение     | Только блокирующее | Блокирующее + демон-потоки|
| Уведомления    | Нет              | Очередь, вычитываемая на каждом цикле |
| Конкурентность | Нет              | Демон-потоки               |

## Попробуй

```sh
cd learn_agent
python agents/s08_background_tasks.py
```

1. `Запусти "sleep 5 && echo done" в фоне, а пока она крутится, создай файл`
2. `Запусти 3 фоновые задачи: "sleep 2", "sleep 4", "sleep 6". Проверь их статус.`
3. `Запусти pytest в фоне и продолжай заниматься другими делами`
