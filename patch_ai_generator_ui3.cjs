const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target1 = `                        <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
                          <button
                            onClick={() => setExerciseFormat('typing')}
                            className={\`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              exerciseFormat === 'typing' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white'
                            }\`}
                          >
                            <Keyboard className="w-4 h-4" />
                            {language === 'pl' ? 'Wpisywanie klawiaturą' : 'Keyboard typing'}
                          </button>
                          <button
                            onClick={() => setExerciseFormat('puzzle')}
                            className={\`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              exerciseFormat === 'puzzle' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white'
                            }\`}
                          >
                            <Puzzle className="w-4 h-4" />
                            {language === 'pl' ? 'Układanka ze słów' : 'Word puzzle'}
                          </button>
                        </div>`;

const replacement1 = `                        <div className="flex flex-col bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner gap-1.5">
                          <div className="text-center text-xs font-bold text-primary mb-1 mt-1">
                            {language === 'pl' ? 'Zrób najpierw rozgrzewkę: Układanka słów.' : 'Do a warmup first: Word puzzle.'}
                          </div>
                          <button
                            onClick={() => setExerciseFormat('puzzle')}
                            className={\`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              exerciseFormat === 'puzzle' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white hover:bg-white/5'
                            }\`}
                          >
                            <Puzzle className="w-4 h-4" />
                            {language === 'pl' ? 'Układanka ze słów' : 'Word puzzle'}
                          </button>
                          <button
                            onClick={() => setExerciseFormat('typing')}
                            className={\`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              exerciseFormat === 'typing' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white hover:bg-white/5'
                            }\`}
                          >
                            <Keyboard className="w-4 h-4" />
                            {language === 'pl' ? 'Wpisywanie klawiaturą' : 'Keyboard typing'}
                          </button>
                        </div>`;

const target2 = `                        <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
                          <button
                            onClick={() => setPracticeMode('fixed')}
                            className={\`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              practiceMode === 'fixed' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white'
                            }\`}
                          >
                            <Target className="w-4 h-4" />
                            {language === 'pl' ? 'Na ilość zdań' : 'Fixed quantity'}
                          </button>
                          <button
                            onClick={() => setPracticeMode('time')}
                            className={\`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              practiceMode === 'time' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white'
                            }\`}
                          >
                            <Clock className="w-4 h-4" />
                            {language === 'pl' ? 'Na czas (Wyzwanie)' : 'Time challenge'}
                          </button>
                        </div>`;

const replacement2 = `                        <div className="flex flex-col bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner gap-1.5">
                          <button
                            onClick={() => setPracticeMode('fixed')}
                            className={\`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              practiceMode === 'fixed' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white hover:bg-white/5'
                            }\`}
                          >
                            <Target className="w-4 h-4" />
                            {language === 'pl' ? 'Na ilość zdań' : 'Fixed quantity'}
                          </button>
                          <button
                            onClick={() => setPracticeMode('time')}
                            className={\`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 \${
                              practiceMode === 'time' 
                                 ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                                 : 'text-content-muted hover:text-white hover:bg-white/5'
                            }\`}
                          >
                            <Clock className="w-4 h-4" />
                            {language === 'pl' ? 'Na czas (Wyzwanie)' : 'Time challenge'}
                          </button>
                        </div>`;

if (code.includes(target1) && code.includes(target2)) {
  code = code.replace(target1, replacement1).replace(target2, replacement2);
  fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
  console.log('patched AIExerciseGeneratorScreen.tsx');
} else {
  console.log('target not found in AIExerciseGeneratorScreen.tsx');
}
