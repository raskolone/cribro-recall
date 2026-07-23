import re
with open('components/admin/AdminTestGenerator.tsx', 'r') as f:
    text = f.read()

text = re.sub(r'\s*\);\n\};\n\s*\)\}\n\s*</div>\n\s*\);\n\};\nexport default AdminTestGenerator;', 
              '\n        )}\n      </div>\n    </div>\n  );\n};\nexport default AdminTestGenerator;', text)

with open('components/admin/AdminTestGenerator.tsx', 'w') as f:
    f.write(text)
