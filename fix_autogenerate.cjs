const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

content = content.replace(
  /if \(extra && extra.autoGenerate !== undefined\) \{\s*\(window as any\)._autoGenerate = extra.autoGenerate;\s*\}/g,
  `if (extra && extra.autoGenerate !== undefined) {
              (window as any)._autoGenerate = extra.autoGenerate;
            } else {
              delete (window as any)._autoGenerate;
            }`
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', content);
