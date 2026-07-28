const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

content = content.replace('<link rel="apple-touch-icon" href="/favicon.svg">', '<link rel="apple-touch-icon" href="/apple-touch-icon.png">');

fs.writeFileSync('index.html', content);
