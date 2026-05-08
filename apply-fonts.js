import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const walk = (dir, callback) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory() && file !== 'node_modules') {
      walk(filepath, callback);
    } else if (stats.isFile() && filepath.endsWith('.tsx')) {
      callback(filepath);
    }
  }
};

walk('./components', (file) => {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  const transformed = content.replace(/<(h[123])([^>]*)className=(["'])(.*?)\3([^>]*)>/g, (match, tag, beforeClass, quote, classNames, afterClass) => {
    if (!classNames.includes('font-display')) {
      changed = true;
      let newClassNames = classNames + ' font-display';
      return `<${tag}${beforeClass}className=${quote}${newClassNames}${quote}${afterClass}>`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(file, transformed);
    console.log(`Updated ${file}`);
  }
});
