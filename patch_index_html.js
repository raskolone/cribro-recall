import fs from 'fs';

let content = fs.readFileSync('index.html', 'utf-8');

// remove tailwind CDN
content = content.replace('<script src="https://cdn.tailwindcss.com"></script>', '');

// remove script tailwind.config
content = content.replace(/<script>\s*tailwind\.config = \{[\s\S]*?\}\s*<\/script>/, '');

// remove style tag block
content = content.replace(/<style>\s*\/\* Hide scrollbar[\s\S]*?<\/style>/, '');

fs.writeFileSync('index.html', content);
console.log("Patched index.html");
