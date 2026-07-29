const fs = require('fs');
let code = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

// Ensure Volume2 is imported from lucide-react
if (!code.includes("Volume2")) {
    code = code.replace(/import \{ ([^}]+) \} from 'lucide-react';/, "import { $1, Volume2 } from 'lucide-react';");
    if (!code.includes("Volume2")) {
        code = code.replace(/import React/, "import { Volume2 } from 'lucide-react';\nimport React");
    }
}

// 1. Add "Play Assembled Sentence" button inside the Answer Area
const playAssembledBtn = `
        {selectedTiles.length > 0 && !isCompleted && (
          <button 
            onClick={() => playAudio(selectedTiles.map(t => t.text).join(' '))}
            disabled={isPlayingAudio}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/5 hover:bg-white/10 text-emerald-400 transition-colors z-30 disabled:opacity-50"
            title={i18n.t("Posłuchaj ułożonego fragmentu")}
          >
            <Volume2 className="w-5 h-5" />
          </button>
        )}
        <>
`;
code = code.replace(/\{selectedTiles\.length === 0 && \([\s\S]*?<\/span>\s*\)\}\s*<>/, `$&` + "\n" + playAssembledBtn);

// 2. Add small speaker on available tiles for playing single words
const tileWithSpeaker = `
              <div
                key={tile.id}
                className="relative group inline-block"
              >
                <button
                  id={tile.id}
                  type="button"
                  onClick={(e) => handleTileClick(tile, e)}
                  disabled={isCompleted}
                  className={\`pr-8 pl-4 py-2.5 rounded-xl font-bold text-sm md:text-base shadow-sm backdrop-blur-md border z-10
                    \${isError 
                      ? 'bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.9)] scale-105' 
                      : \`\${tile.colorClass} hover:scale-105 hover:-translate-y-1 hover:shadow-lg cursor-pointer active:scale-95 transition-colors duration-200\`
                    }\`}
                >
                  {tile.text}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); playAudio(tile.text); }}
                  disabled={isPlayingAudio || isCompleted}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors z-20"
                  title="Posłuchaj słowa"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
`;

// Replace the current tile rendering
const originalTileRendering = /<button\s*key=\{tile\.id\}[\s\S]*?<\/button>/;
code = code.replace(originalTileRendering, tileWithSpeaker);

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', code);
