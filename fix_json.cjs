const fs = require('fs');
const file = 'services/geminiService.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const jsonText = response.text.trim\(\);/g, `let jsonText = response.text.trim();
    if (jsonText.startsWith('\`\`\`json')) {
      jsonText = jsonText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (jsonText.startsWith('\`\`\`')) {
      jsonText = jsonText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }`);

code = code.replace(/return JSON.parse\(response.text.trim\(\)\)(.*);/g, `let jsonText = response.text.trim();
    if (jsonText.startsWith('\`\`\`json')) {
      jsonText = jsonText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (jsonText.startsWith('\`\`\`')) {
      jsonText = jsonText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }
    return JSON.parse(jsonText)$1;`);

fs.writeFileSync(file, code);
