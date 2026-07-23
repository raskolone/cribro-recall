const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const \[scope, setScope\] = useState\(''\);/,
  "const [scope, setScope] = useState('');\n  const [instructions, setInstructions] = useState('');"
);

content = content.replace(
  /setScope\(''\);/,
  "setScope('');\n      setInstructions('');"
);

content = content.replace(
  /scope,\n        dueDate,/,
  "scope,\n        instructions,\n        dueDate,"
);

// Add input field for instructions
content = content.replace(
  /<div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">/,
  `</div>\n            \n            <div>\n              <label className="block text-sm font-bold text-content-muted mb-1">Instrukcje dla kursanta (opcjonalne)</label>\n              <textarea\n                value={instructions}\n                onChange={e => setInstructions(e.target.value)}\n                className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 min-h-[80px]"\n                placeholder="np. Czas na wykonanie testu to 60 minut..."\n              />\n            </div>\n\n            <div>\n              <label className="block text-sm font-bold text-content-muted mb-1">Źródła materiału do testu</label>\n              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">`
);

fs.writeFileSync(file, content);
