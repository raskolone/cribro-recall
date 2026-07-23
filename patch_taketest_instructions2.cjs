const fs = require('fs');
const file = 'components/tests/TakeTestScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<strong>Instrukcje:<\/strong>\\n\{test\.instructions\}/,
  '<strong>Instrukcje:</strong><br/>{test.instructions}'
);

fs.writeFileSync(file, content);
