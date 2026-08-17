import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r') as f:
    content = f.read()

# find the broken section
broken_section = """                                      </div>
                                       
                                    )}"""

fixed_section = """                                      </div>
                                    ) : (
                                      <div className="text-center text-xs text-gray-400 py-3">Brak dodanych lekcji</div>
                                    )}"""

if broken_section in content:
    content = content.replace(broken_section, fixed_section)
else:
    print("Broken section not found. Attempting regex.")
    content = re.sub(r'(\s+)</div>\s+)}', r'\1</div>\1) : (\1  <div className="text-center text-xs text-gray-400 py-3">Brak dodanych lekcji</div>\n\1)}', content)

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w') as f:
    f.write(content)

