const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const importStr = "import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';\nimport { db } from '../firebase';\n";

if (!code.includes('import { collection')) {
  code = importStr + code;
}

fs.writeFileSync('services/geminiService.ts', code);
