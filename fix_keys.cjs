const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// Replace duplicate keys like `key="global-loader" key="global-loader"` with just `key="global-loader"`
content = content.replace(/key="([^"]+)"\s+key="\1"/g, 'key="$1"');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
console.log("Fixed duplicate keys!");
