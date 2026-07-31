const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');
code = code.replace(
  "hasNewLesson?: boolean;",
  "hasNewLesson?: boolean;\n  adminMessage?: { title: string; text: string; createdAt: string; } | null;"
);
fs.writeFileSync('types.ts', code);
