const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

if (!content.includes('import { VitePWA } from \'vite-plugin-pwa\'')) {
    content = content.replace("import react from '@vitejs/plugin-react';", "import react from '@vitejs/plugin-react';\nimport { VitePWA } from 'vite-plugin-pwa';");
    content = content.replace("plugins: [react(), tailwindcss()],", `plugins: [
        react(), 
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'cribro-logo.svg'],
          manifest: {
            name: 'CRIBRO ENGLISH',
            short_name: 'Cribro',
            description: 'Your English AI Coach - Spersonalizowane lekcje angielskiego z AI',
            theme_color: '#0a0a0a',
            background_color: '#0a0a0a',
            display: 'standalone',
            icons: [
              {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              },
              {
                src: 'favicon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            maximumFileSizeToCacheInBytes: 5000000,
            navigateFallbackDenylist: [/^\/api/]
          }
        })
      ],`);
    fs.writeFileSync('vite.config.ts', content);
}
