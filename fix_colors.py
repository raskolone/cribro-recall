with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("{ scale: 1.5, color: '#ffffff' }, \n        { scale: 1, color: '#ffffff', duration: 0.5, ease: 'power2.out' }", "{ scale: 1.5, color: '#ffffff' }, \n        { scale: 1, color: '#72f0b4', duration: 0.5, ease: 'power2.out' }")

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
