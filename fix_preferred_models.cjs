const fs = require('fs');
const lines = fs.readFileSync('services/geminiService.ts', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const preferredModels = ['deepseek-chat', 'openai/gpt-4o-mini'];")) {
    if (i !== 569) { // 569 is the index for line 570
      lines[i] = lines[i].replace("['deepseek-chat', 'openai/gpt-4o-mini']", "PREFERRED_AI_MODELS");
    }
  }
}

fs.writeFileSync('services/geminiService.ts', lines.join('\n'));
