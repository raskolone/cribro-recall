const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update options
content = content.replace(
  /{ id: 'writing', label: 'Writing \(otwarte\)' },/,
  "{ id: 'writing', label: 'Writing (otwarte)' },\n                  { id: 'find_mistake', label: 'Wybór poprawnego zdania' },"
);

// Update label rendering
content = content.replace(
  /q\.type === 'multiple_choice' \? 'Wielokrotny wybór' : q\.type === 'fill_in_blank' \? 'Luki' : q\.type === 'matching' \? 'Łączenie w pary' : q\.type === 'writing' \? 'Writing' : 'Tłumaczenie'/,
  "q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : q.type === 'find_mistake' ? 'Poprawne zdanie' : 'Tłumaczenie'"
);

// Update options rendering (we want to show it for multiple_choice and find_mistake)
content = content.replace(
  /q\.type === 'multiple_choice' && q\.options && \(/,
  "(q.type === 'multiple_choice' || q.type === 'find_mistake') && q.options && ("
);

// Add writingTopic prompt logic
content = content.replace(
  /const handleGenerate = async \(\) => {/g,
  `const handleGenerate = async () => {\n    if (selectedTypes.includes('writing')) {\n      const topic = window.prompt("Wybrałeś zadanie Writing. Podaj temat lub instrukcje dla writingu:");\n      if (!topic) return alert("Temat writingu jest wymagany, aby wygenerować test z tym typem zadania.");\n      setScope(prev => prev + "\\n\\n[TEMAT WRITINGU]: " + topic);\n    }`
);

// Include 'find_mistake' in default types
content = content.replace(
  /const \[selectedTypes, setSelectedTypes\] = useState<string\[\]>\(\['multiple_choice', 'fill_in_blank', 'translation', 'matching', 'writing'\]\);/,
  "const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice', 'fill_in_blank', 'translation', 'matching', 'writing', 'find_mistake']);"
);

fs.writeFileSync(file, content);
