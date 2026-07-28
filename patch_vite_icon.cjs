const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace("includeAssets: ['favicon.svg', 'cribro-logo.svg', 'apple-touch-icon.png']", "includeAssets: ['favicon.svg', 'cribro-logo.svg', 'apple-touch-icon.png', 'cribro-icon.svg']");
content = content.replace("description: 'Your English AI Coach - Spersonalizowane lekcje angielskiego z AI'", "description: 'Cribro English'");
content = content.replace("icons: [", `icons: [
              {
                src: 'cribro-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              },`);

fs.writeFileSync('vite.config.ts', content);
