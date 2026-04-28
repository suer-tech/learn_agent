# s01: Цикл агента

`[ s01 ] s02 > s03 > s04 > s05 > s06 | s07 > s08 > s09 > s10 > s11 > s12`

> *"One loop & Bash is all you need"* -- один инструмент + один цикл = агент.
>
> **Слой harness**: Цикл -- первое соединение модели с реальным миром.

## Проблема

Языковая модель умеет рассуждать о коде, но не может *прикоснуться* к реальному миру -- не может читать файлы, запускать тесты или проверять ошибки. Без цикла каждый вызов инструмента требует от вас вручную копировать результаты обратно. Вы сами становитесь циклом.

## Решение

Замкнуть петлю: пока модель просит вызвать инструмент, цикл сам выполняет вызов и возвращает результат обратно в `messages`. Цикл крутится, пока модель не ответит обычным текстом — `stop_reason != "tool_use"`. Один сигнал управляет всем потоком: сама модель решает, когда остановиться.

## Как это работает

1. Запрос пользователя становится первым сообщением.

```python
messages.append({"role": "user", "content": query})
```

2. Отправляем messages + определения инструментов в LLM.

```python
response = client.messages.create(
    model=MODEL, system=SYSTEM, messages=messages,
    tools=TOOLS, max_tokens=8000,
)
```

3. Добавляем ответ ассистента. Проверяем `stop_reason` -- если модель не вызвала инструмент, мы закончили.

```python
messages.append({"role": "assistant", "content": response.content})
if response.stop_reason != "tool_use":
    return
```

4. Выполняем каждый вызов инструмента, собираем результаты, добавляем как сообщение пользователя. Возвращаемся к шагу 2.

```python
results = []
for block in response.content:
    if block.type == "tool_use":
        output = run_bash(block.input["command"])
        results.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": output,
        })
messages.append({"role": "user", "content": results})
```

Собранное в одну функцию:

```python
def agent_loop(query):
    messages = [{"role": "user", "content": query}]
    while True:
        response = client.messages.create(
            model=MODEL, system=SYSTEM, messages=messages,
            tools=TOOLS, max_tokens=8000,
        )
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            return

        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = run_bash(block.input["command"])
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                })
        messages.append({"role": "user", "content": results})
```

Это весь агент в менее чем 30 строках. Всё остальное в этом курсе наслаивается поверх -- без изменения цикла.

## Что изменилось

| Компонент      | До         | После                          |
|----------------|------------|--------------------------------|
| Цикл агента    | (нет)      | `while True` + stop_reason     |
| Инструменты    | (нет)      | `bash` (один инструмент)       |
| Messages       | (нет)      | Накапливающийся список         |
| Поток управления | (нет)    | `stop_reason != "tool_use"`    |

## Попробуйте

```sh
cd learn-claude-code
python agents/s01_agent_loop.py
```

1. `Создай файл hello.py, который печатает "Hello, World!"`
2. `Перечисли все Python-файлы в этой директории`
3. `Какая сейчас ветка git?`
4. `Создай директорию test_output и запиши в неё 3 файла`
