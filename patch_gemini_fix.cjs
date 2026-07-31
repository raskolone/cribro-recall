const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const oldHint = "- HINT REQUIREMENT: Pole `hint` musi ZAWSZE";
const newHint = "- HINT REQUIREMENT: Pole \\`hint\\` musi ZAWSZE";
code = code.replace(oldHint, newHint);

const oldVerification = "Pole `hint` również MUSI";
const newVerification = "Pole \\`hint\\` również MUSI";
code = code.replace(oldVerification, newVerification);

fs.writeFileSync('services/geminiService.ts', code);
