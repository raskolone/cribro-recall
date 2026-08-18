import re
with open('vite.config.ts', 'r') as f:
    content = f.read()

content = content.replace("server: {\n        port: 3000,\n        host: '0.0.0.0',\n      },", "server: {\n        port: 3000,\n        host: '0.0.0.0',\n        hmr: false,\n        watch: { usePolling: false },\n      },")

with open('vite.config.ts', 'w') as f:
    f.write(content)
