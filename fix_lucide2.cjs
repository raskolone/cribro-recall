const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/Timer\n\} from 'lucide-react';/, 'Timer,\n  Volume2,\n  Loader2\n} from \'lucide-react\';');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed lucide2');
