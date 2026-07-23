const fs = require('fs');
const file = 'components/tests/TakeTestScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<strong>Zakres:<\/strong> \{test\.scope\}\n      <\/div>/,
  '<strong>Zakres:</strong> {test.scope}\n      </div>\n      {test.instructions && (\n        <div className="bg-primary/5 text-primary border border-primary/20 p-4 rounded-xl mb-8 whitespace-pre-wrap">\n          <strong>Instrukcje:</strong>\\n{test.instructions}\n        </div>\n      )}'
);

fs.writeFileSync(file, content);
