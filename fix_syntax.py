import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace(") : (\n                                    )}", ") : (\n                                      <div className=\"text-center text-xs text-gray-400 py-3\">Brak dodanych lekcji</div>\n                                    )}")

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w') as f:
    f.write(content)

