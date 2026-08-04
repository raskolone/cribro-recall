const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

code = code.replace(/temperature: 0\.7\n\s*\}\);/g, 'temperature: 0.7,\n      response_format: { type: "json_object" }\n    });');

fs.writeFileSync('services/geminiService.ts', code);
