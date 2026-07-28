const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace("includeAssets: ['favicon.svg', 'cribro-logo.svg'],", "includeAssets: ['favicon.svg', 'cribro-logo.svg', 'apple-touch-icon.png'],");
content = content.replace("icons: [", `icons: [
              {
                src: 'icon-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },`);

fs.writeFileSync('vite.config.ts', content);
