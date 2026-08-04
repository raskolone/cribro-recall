const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

code = code.replace(
  "formatAIModelName(currentModel || 'deepseek-chat')",
  "formatAIModelName(currentModel || 'openai/gpt-4o-mini')"
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
