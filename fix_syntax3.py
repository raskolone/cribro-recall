with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "</div>" in line and lines[i+1].strip() == "" and lines[i+2].strip() == ")}":
        lines[i+1] = "                                    ) : (\n                                      <div className=\"text-center text-xs text-gray-400 py-3\">Brak dodanych lekcji</div>\n"
        break
        
with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w') as f:
    f.writelines(lines)
