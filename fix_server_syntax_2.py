import re

with open('server.ts', 'r') as f:
    text = f.read()

# Replace trailing `}); \n }` in parseBulkReplace
text = re.sub(r'let response = await generateContentWithRetry\([^;]+;\s+\}\);\s+\}', 
    lambda m: m.group(0).replace('});\n      }', '});'), text)

with open('server.ts', 'w') as f:
    f.write(text)
