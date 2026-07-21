const fs = require('fs');
const path = 'server.ts';
let content = fs.readFileSync(path, 'utf8');

const badDriveText = `        } else {
            const text = await fetchRes.text();
            promptContext = [
              { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania (Google Docs / Text):\\n\${text}\` }
            ];
        }`;

const goodDriveText = `        } else {
            const text = await fetchRes.text();
            promptContext = [{
              role: 'user',
              parts: [{ text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania (Google Docs / Text):\\n\${text}\` }]
            }];
        }`;

content = content.replace(badDriveText, goodDriveText);

const badElseText = `      } else {
        promptContext = [
          { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania:\\n\${notes}\` }
        ];
      }`;

const goodElseText = `      } else {
        promptContext = [{
          role: 'user',
          parts: [{ text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania:\\n\${notes}\` }]
        }];
      }`;

content = content.replace(badElseText, goodElseText);

fs.writeFileSync(path, content);
console.log("Patched server.ts contents format");
