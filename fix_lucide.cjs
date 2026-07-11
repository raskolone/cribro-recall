const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

if (!code.includes('Volume2')) {
  code = code.replace(/} from 'lucide-react';/, '  Volume2,\n  Loader2\n} from \'lucide-react\';');
}

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed lucide');
