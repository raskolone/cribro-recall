const fs = require('fs');
let content = fs.readFileSync('index.css', 'utf8');

const oldCss = `  box-shadow: 0 16px 48px -8px rgba(0, 0, 0, 0.5), 0 0 20px rgba(114, 240, 180, 0.12), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.35), inset -1px -1px 0 0 rgba(255, 255, 255, 0.08) !important;
  transform: translateY(-4px) scale(1.03) !important;`;
  
const newCss = `  box-shadow: 0 16px 48px -8px rgba(0, 0, 0, 0.5), 0 0 30px 2px rgba(114, 240, 180, 0.4), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.35), inset -1px -1px 0 0 rgba(255, 255, 255, 0.08) !important;
  transform: translateY(-4px) scale(1.05) !important;
  z-index: 10;`;

if(content.includes(oldCss)) {
  content = content.replace(oldCss, newCss);
  fs.writeFileSync('index.css', content);
  console.log('index.css updated');
} else {
  console.log('oldCss not found');
}
