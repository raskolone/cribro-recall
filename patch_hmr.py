with open('vite.config.ts', 'r') as f:
    content = f.read()

content = content.replace("hmr: { clientPort: 443 },", "hmr: false, watch: { usePolling: false },")

with open('vite.config.ts', 'w') as f:
    f.write(content)
