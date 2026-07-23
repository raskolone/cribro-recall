const fs = require('fs');

let content = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

const newAudioLogic = `
  const playSentence = (accent: 'en-GB' | 'en-US') => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence as string);
    utterance.lang = accent;
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang === accent || v.lang.startsWith(accent));
    if (targetVoice) {
      utterance.voice = targetVoice;
    }
    window.speechSynthesis.speak(utterance);
  };
`;

content = content.replace(/const containerRef = useRef<HTMLDivElement>\(null\);/, newAudioLogic + '\n  const containerRef = useRef<HTMLDivElement>(null);');

const successMsg = `{i18n.t("Świetnie! Całe zdanie ułożone.")}
                          </motion.div>
      )}`;

const replacementMsg = `{i18n.t("Świetnie! Całe zdanie ułożone.")}
                          </motion.div>
      )}

      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-3 mt-4"
        >
          <p className="text-content-muted text-sm uppercase tracking-widest">{i18n.t("Przeczytaj zdanie")}</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => playSentence('en-GB')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-base-300 hover:bg-base-200 transition-colors shadow-sm"
              title={i18n.t("Wymowa brytyjska")}
            >
              <span className="text-xl">🇬🇧</span>
              <span className="font-bold text-sm">BrE</span>
            </button>
            <button
              onClick={() => playSentence('en-US')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-base-300 hover:bg-base-200 transition-colors shadow-sm"
              title={i18n.t("Wymowa amerykańska")}
            >
              <span className="text-xl">🇺🇸</span>
              <span className="font-bold text-sm">AmE</span>
            </button>
          </div>
        </motion.div>
      )}`;

content = content.replace(successMsg, replacementMsg);

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', content);
