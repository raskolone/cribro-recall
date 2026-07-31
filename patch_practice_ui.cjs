const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetSentence = `{/* Polish Sentence */}
              {exerciseFormat !== 'puzzle' && (
                <div className="text-base sm:text-lg font-bold text-white tracking-tight leading-relaxed">
                  {exercises[activeSentenceIndex].polishSentence}
                </div>
              )}`;

const newSentence = `{/* Polish Sentence */}
              {exerciseFormat !== 'puzzle' && (
                <div className="w-full bg-[#18212e] border border-white/10 rounded-2xl p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] mb-2">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-relaxed text-center">
                    {exercises[activeSentenceIndex].polishSentence}
                  </div>
                </div>
              )}`;

code = code.replace(targetSentence, newSentence);

const targetAnswer = `{/* Student answer field */}
              <div className="w-full space-y-2 mt-2 pt-3 border-t border-white/5 flex flex-col items-center">
                {exerciseFormat !== 'puzzle' && (
                  <label className="block text-xs font-semibold text-content-muted/80 text-center w-full">
                    {language === 'pl' ? 'Twoje tłumaczenie na angielski:' : 'Your translation to English:'}
                  </label>
                )}`;

const newAnswer = `{/* Student answer field */}
              <div className="w-full space-y-3 mt-4 pt-4 border-t border-white/5 flex flex-col items-center">
                {exerciseFormat !== 'puzzle' && (
                  <label className="block text-sm font-bold text-emerald-400/80 text-center w-full uppercase tracking-widest">
                    {language === 'pl' ? 'Twoje tłumaczenie na angielski:' : 'Your translation to English:'}
                  </label>
                )}`;

code = code.replace(targetAnswer, newAnswer);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
