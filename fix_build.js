const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

// The early return might be placed in a bad spot causing build failure. Let's make sure it's correct.
const lines = code.split('\n');
const earlyReturnIdx = lines.findIndex(l => l.includes('if (!isOpen) return null;'));

if (earlyReturnIdx !== -1) {
    console.log("Found early return at line:", earlyReturnIdx + 1);
} else {
    console.log("Could not find early return");
}
