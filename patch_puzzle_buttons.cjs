const fs = require('fs');

let content = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

const target = `        <>
          {selectedTiles.map((st, idx) => (
            <button
              ref={(el) => {
                answerTileRefs.current[st.id] = el;
              }}
              key={st.id + '-ans'}
              type="button"
              onClick={() => handleRemoveTile(st, idx)}
              className={\`px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm z-20 backdrop-blur-md \${
                isCompleted 
                  ? 'bg-primary text-black border border-primary/50 cursor-default' 
                  : \`\${st.colorClass} border hover:bg-red-500/80 hover:text-white hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.6)] cursor-pointer\`
              }\`}
            >
              {st.text}
            </button>
          ))}
        </>`;

const replacement = `        <>
          {selectedTiles.map((st, idx) => (
            <button
              ref={(el) => {
                answerTileRefs.current[st.id] = el;
              }}
              key={st.id + '-ans'}
              type="button"
              onClick={() => handleRemoveTile(st, idx)}
              className={\`px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm z-20 backdrop-blur-md \${
                isCompleted 
                  ? 'bg-primary text-black border border-primary/50 cursor-default' 
                  : \`\${st.colorClass} border hover:bg-red-500/80 hover:text-white hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.6)] cursor-pointer\`
              }\`}
            >
              {st.text}
            </button>
          ))}
        </>
        {isCompleted && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-30 bg-base-100/80 p-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-lg animate-in fade-in zoom-in duration-300">
            <button onClick={(e) => { e.stopPropagation(); playAudio(sentence, 'en-US'); }} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇺🇸 Amerykański")} disabled={isPlayingAudio}>🇺🇸</button>
            <button onClick={(e) => { e.stopPropagation(); playAudio(sentence, 'en-GB'); }} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇬🇧 Brytyjski")} disabled={isPlayingAudio}>🇬🇧</button>
          </div>
        )}`;

content = content.replace(target, replacement);
fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', content);
