const fs = require('fs');
let code = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

// replace 🇬🇧 BrE and 🇺🇸 AmE with mic/volume icons.
const gbMatch = `<span className="text-xl">🇬🇧</span>
              <span className="font-bold text-sm">BrE</span>`;
const usMatch = `<span className="text-xl">🇺🇸</span>
              <span className="font-bold text-sm">AmE</span>`;

code = code.replace(gbMatch, `<Volume2 className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm">BrE (UK)</span>`);

code = code.replace(usMatch, `<Volume2 className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-sm">AmE (US)</span>`);

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', code);
