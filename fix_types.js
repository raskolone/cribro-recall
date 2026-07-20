import fs from 'fs';

let file = './types.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /isSuspended\?: boolean;/,
  "isSuspended?: boolean;\n  tempPasswordLogins?: number;\n  onboardingCompleted?: boolean;\n  tempPassword?: string;"
);

fs.writeFileSync(file, content);
console.log("Updated types.ts");
