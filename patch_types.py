with open('types.ts', 'r') as f:
    content = f.read()

content = content.replace('isPublic: boolean;', 'isPublic: boolean;\n  isDraft?: boolean;')

with open('types.ts', 'w') as f:
    f.write(content)

