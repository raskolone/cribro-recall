const fs = require('fs');
let code = fs.readFileSync('services/deepseekService.ts', 'utf8');

code = code.replace(/model: "deepseek-chat",/g, 'model: "deepseek-chat",\n      response_format: { type: "json_object" },');

fs.writeFileSync('services/deepseekService.ts', code);
