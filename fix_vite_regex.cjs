const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace('navigateFallbackDenylist: [/^/api/]', 'navigateFallbackDenylist: [/^\\/api/]');

fs.writeFileSync('vite.config.ts', content);
