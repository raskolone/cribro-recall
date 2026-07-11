const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const oldStyles = "const loadingStyles = 'bg-[#00FF66] text-black cursor-wait shadow-[0_0_30px_rgba(0,255,102,0.8)] animate-[pulse_1s_ease-in-out_infinite] scale-[1.02]';";
const newStyles = "const loadingStyles = 'bg-[#00FF66] text-black cursor-wait shadow-[0_0_30px_rgba(0,255,102,0.8)] animate-pulse scale-[1.02] transition-transform duration-300';";

code = code.replace(oldStyles, newStyles);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
