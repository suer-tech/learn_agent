# s05: Навыки

`s01 > s02 > s03 > s04 > [ s05 ] s06 | s07 > s08 > s09 > s10 > s11 > s12`

> *"Load knowledge when you need it, not upfront"* -- инъекция через `tool_result`, а не через системный промпт.
>
> **Слой harness**: Знания по требованию -- доменная экспертиза, загружаемая, когда её просит модель.

## Проблема

Вы хотите, чтобы агент следовал доменным процессам: соглашениям git, паттернам тестирования, чек-листам ревью кода. Положить всё в системный промпт -- значит тратить токены на неиспользуемые навыки. 10 навыков по 2000 токенов каждый = 20000 токенов, большая часть которых нерелевантна для любой конкретной задачи.

## Решение

Разделить знания на два слоя. В системном промпте всегда лежит лишь короткий каталог: имя и одно-строчное описание каждого навыка — это дёшево. Полное тело инструкций модель загружает сама вызовом `load_skill("git")`, и оно приходит в `tool_result` только тогда, когда действительно нужно. Так нерелевантные навыки не съедают окно контекста, а добавление нового навыка сводится к новой папке `SKILL.md`.

## Как это работает

1. Каждый навык -- это директория с файлом `SKILL.md` и YAML-фронтматтером.

```
skills/
  pdf/
    SKILL.md       # ---\n name: pdf\n description: Process PDF files\n ---\n ...
  code-review/
    SKILL.md       # ---\n name: code-review\n description: Review code\n ---\n ...
```

2. `SkillLoader` сканирует файлы `SKILL.md`, использует имя директории как идентификатор навыка.

```python
class SkillLoader:
    def __init__(self, skills_dir: Path):
        self.skills = {}
        for f in sorted(skills_dir.rglob("SKILL.md")):
            text = f.read_text()
            meta, body = self._parse_frontmatter(text)
            name = meta.get("name", f.parent.name)
            self.skills[name] = {"meta": meta, "body": body}

    def get_descriptions(self) -> str:
        lines = []
        for name, skill in self.skills.items():
            desc = skill["meta"].get("description", "")
            lines.append(f"  - {name}: {desc}")
        return "\n".join(lines)

    def get_content(self, name: str) -> str:
        skill = self.skills.get(name)
        if not skill:
            return f"Error: Unknown skill '{name}'."
        return f"<skill name=\"{name}\">\n{skill['body']}\n</skill>"
```

3. Слой 1 уходит в системный промпт. Слой 2 -- это просто ещё один обработчик инструмента.

```python
SYSTEM = f"""You are a coding agent at {WORKDIR}.
Skills available:
{SKILL_LOADER.get_descriptions()}"""

TOOL_HANDLERS = {
    # ...base tools...
    "load_skill": lambda **kw: SKILL_LOADER.get_content(kw["name"]),
}
```

Модель узнаёт, какие навыки существуют (дёшево), и подгружает их, когда они актуальны (дорого).

## Что изменилось по сравнению с s04

| Компонент       | До (s04)         | После (s05)                  |
|-----------------|------------------|------------------------------|
| Инструменты     | 5 (база + task)  | 5 (база + load_skill)        |
| Системный промпт| Статическая строка | + описания навыков         |
| Знания          | Нет              | Файлы skills/\*/SKILL.md     |
| Инъекция        | Нет              | Двухслойная (system + result)|

## Попробуйте

```sh
cd learn-claude-code
python agents/s05_skill_loading.py
```

1. `Какие навыки доступны?`
2. `Загрузи навык agent-builder и следуй его инструкциям`
3. `Мне нужно провести код-ревью — сначала загрузи подходящий навык`
4. `Собери MCP-сервер с помощью навыка mcp-builder`
