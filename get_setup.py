with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

start_marker = "      {step === 'setup' && ("
end_marker = "      {step === 'practice' && exercises.length > 0 && ("

start_idx = code.find(start_marker)
end_idx = code.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    print(code[start_idx:end_idx])
