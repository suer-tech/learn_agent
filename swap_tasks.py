import json
import codecs

with codecs.open('c:/Users/suer/Documents/learn_agent/web/src/data/practice/tasks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find indices
idx4 = next((i for i, t in enumerate(data['tasks']) if t['id'] == 'agent-loop-basic'), -1)
idx5 = next((i for i, t in enumerate(data['tasks']) if t['id'] == 'task-prompt-selection'), -1)

if idx4 != -1 and idx5 != -1:
    # Swap elements
    data['tasks'][idx4], data['tasks'][idx5] = data['tasks'][idx5], data['tasks'][idx4]
    
    # Update titles
    for t in data['tasks']:
        if t['id'] == 'task-prompt-selection':
            t['title'] = t['title'].replace('Задача 5', 'Задача 4')
        elif t['id'] == 'agent-loop-basic':
            t['title'] = t['title'].replace('Задача 4', 'Задача 5')

with codecs.open('c:/Users/suer/Documents/learn_agent/web/src/data/practice/tasks.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Tasks swapped successfully")
