const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// replace the emojis with the new buttons
const usButton = `<button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇺🇸 Amerykański")} disabled={isPlayingAudio}>🇺🇸</button>`;
const gbButton = `<button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇬🇧 Brytyjski")} disabled={isPlayingAudio}>🇬🇧</button>`;

const newUs = `<button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-cyan-400 text-xs font-bold transition-all \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("Wymowa amerykańska")} disabled={isPlayingAudio}>
  <Volume2 className="w-3.5 h-3.5" /> AmE
</button>`;
const newGb = `<button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-emerald-400 text-xs font-bold transition-all \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("Wymowa brytyjska")} disabled={isPlayingAudio}>
  <Volume2 className="w-3.5 h-3.5" /> BrE
</button>`;

code = code.replace(usButton, newUs);
code = code.replace(gbButton, newGb);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
