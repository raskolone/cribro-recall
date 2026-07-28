const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

if (!content.includes('apple-mobile-web-app-capable')) {
    content = content.replace('</title>', `</title>\n    <meta name="theme-color" content="#0a0a0a" />\n    <meta name="apple-mobile-web-app-capable" content="yes">\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n    <link rel="apple-touch-icon" href="/favicon.svg">`);
    fs.writeFileSync('index.html', content);
}
