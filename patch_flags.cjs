const fs = require('fs');

let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target = `                         <div className="flex items-center justify-center gap-1.5 shrink-0 bg-black/30 p-1 rounded-md">
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇺🇸 Amerykański")} disabled={isPlayingAudio}>🇺🇸</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇬🇧 Brytyjski")} disabled={isPlayingAudio}>🇬🇧</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-AU')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇦🇺 Australijski")} disabled={isPlayingAudio}>🇦🇺</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-SCT')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🏴󠁧󠁢󠁳󠁣󠁴󠁿 Szkocki")} disabled={isPlayingAudio}>🏴󠁧󠁢󠁳󠁣󠁴󠁿</button>
                         </div>`;

const replacement = `                         <div className="flex items-center justify-center gap-1.5 shrink-0 bg-black/30 p-1 rounded-md mt-2">
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇺🇸 Amerykański")} disabled={isPlayingAudio}>🇺🇸</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={\`text-lg hover:scale-110 transition-transform \${isPlayingAudio ? 'opacity-50' : ''}\`} title={i18n.t("🇬🇧 Brytyjski")} disabled={isPlayingAudio}>🇬🇧</button>
                         </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
