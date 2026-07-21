const fs = require('fs');
const content = fs.readFileSync('tsconfig.json', 'utf8');
const json = JSON.parse(content);
json.exclude = ["dist", "node_modules"];
fs.writeFileSync('tsconfig.json', JSON.stringify(json, null, 2));
console.log("Patched tsconfig.json");
