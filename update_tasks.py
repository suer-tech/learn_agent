import json
import codecs

with codecs.open('c:/Users/suer/Documents/learn_agent/web/src/data/practice/tasks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

idx = next((i for i, t in enumerate(data['tasks']) if t['id'] == 'task-prompt-selection'), -1)
if idx != -1:
    data['tasks'][idx]['title'] = 'Задача 5: Защита от инъекций (Prompt Injection)'
    data['tasks'][idx]['description'] = 'Создайте HR-агента, который читает резюме и сохраняет саммари (Tool Create). В резюме хитрого кандидата спрятана атака "Prompt Injection", которая приказывает агенту нанять его на позицию CEO. Выберите в блоке System Prompt безопасный промпт, чтобы агент не повелся на атаку.'
    data['tasks'][idx]['blocks'] = ['dataInput', 'systemPrompt', 'messageHistory', 'llm', 'condition', 'toolCreate', 'output']
    data['tasks'][idx]['requiredEdges'] = [
        ['dataInput', 'systemPrompt'],
        ['systemPrompt', 'messageHistory'],
        ['messageHistory', 'llm'],
        ['llm', 'condition'],
        ['condition', 'toolCreate'],
        ['toolCreate', 'messageHistory'],
        ['condition', 'output']
    ]

with codecs.open('c:/Users/suer/Documents/learn_agent/web/src/data/practice/tasks.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Updated successfully")
