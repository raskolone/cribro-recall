const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/import \{ Volume2, Loader2 \} from 'lucide-react';/, '');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed AI generator');
