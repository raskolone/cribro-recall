const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Set default selectedTypes to [] and add writingTopic
content = content.replace(
  /const \[selectedTypes, setSelectedTypes\] = useState<string\[\]>\(\['multiple_choice', 'fill_in_blank', 'translation', 'matching', 'writing', 'find_mistake'\]\);/,
  "const [selectedTypes, setSelectedTypes] = useState<string[]>([]);\n  const [writingTopic, setWritingTopic] = useState('');"
);

// 2. Remove instructions
content = content.replace(/const \[instructions, setInstructions\] = useState\(''\);\n\s*/, "");
content = content.replace(/instructions,\n\s*/g, "");
content = content.replace(/setInstructions\(''\);\n\s*/, "");
content = content.replace(
  /\s*<div>\n\s*<label className="block text-sm font-bold text-content-muted mb-1">Instrukcje dla kursanta \(opcjonalne\)<\/label>\n\s*<textarea\n\s*value=\{instructions\}\n\s*onChange=\{e => setInstructions\(e\.target\.value\)\}\n\s*className="w-full bg-base-100 border border-base-300 rounded-lg p-2\.5 outline-none focus:border-primary\/50 min-h-\[80px\]"\n\s*placeholder="np\. Czas na wykonanie testu to 60 minut\.\.\."\n\s*\/>\n\s*<\/div>/,
  ""
);

// 3. Update handleGenerate to use writingTopic
content = content.replace(
  /let currentScope = scope;\n\s*if \(selectedTypes\.includes\('writing'\)\) \{\n\s*const topic = window\.prompt\("Wybrałeś zadanie Writing\. Podaj temat lub instrukcje dla writingu:"\);\n\s*if \(!topic\) return alert\("Temat writingu jest wymagany, aby wygenerować test z tym typem zadania\."\);\n\s*currentScope = scope \+ "\\n\\n\[TEMAT WRITINGU\]: " \+ topic;\n\s*setScope\(currentScope\);\n\s*\}/,
  `let currentScope = scope;\n    if (selectedTypes.includes('writing')) {\n      if (!writingTopic) return alert("Temat writingu jest wymagany, aby wygenerować test z tym typem zadania.");\n      currentScope = scope + "\\n\\n[TEMAT WRITINGU I WYMOGI (np. limit znaków)]: " + writingTopic;\n    }`
);

// 4. Add textarea for writingTopic just after the types selection
content = content.replace(
  /<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">/,
  `</div>\n              </div>\n              {selectedTypes.includes('writing') && (\n                <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">\n                  <label className="block text-sm font-bold text-primary mb-2">Temat writingu i wymagania (np. limit znaków)</label>\n                  <textarea\n                    value={writingTopic}\n                    onChange={e => setWritingTopic(e.target.value)}\n                    className="w-full bg-base-100 border border-white/10 rounded-lg p-3 outline-none focus:border-primary/50 text-white min-h-[100px]"\n                    placeholder="Podaj temat, instrukcje i limit znaków dla zadania otwartego..."\n                  />\n                </div>\n              )}\n            </div>\n\n            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">`
);

fs.writeFileSync(file, content);
