const fs = require('fs');
let css = fs.readFileSync('index.css', 'utf8');

css = css.replace(
  'box-shadow: 0 0 30px 10px rgba(114, 240, 180, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.25);',
  'box-shadow: 0 0 25px 8px rgba(114, 240, 180, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.25);'
);

fs.writeFileSync('index.css', css);
console.log('patched index.css');
