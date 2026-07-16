import json

with open('package.json', 'r') as f:
    data = json.load(f)

deps_to_move = ['vite', '@vitejs/plugin-react', 'esbuild', 'tsx', 'typescript']

for dep in deps_to_move:
    if dep in data.get('devDependencies', {}):
        data['dependencies'][dep] = data['devDependencies'][dep]
        del data['devDependencies'][dep]

with open('package.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Dependencies moved successfully.")
