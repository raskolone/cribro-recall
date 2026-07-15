import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

start_marker = "                {/* Typ tłumaczenia (Klawiatura czy Układanka) */}"
end_marker = "              <div className=\"pt-4\">"

start_idx = code.find(start_marker)
end_idx = code.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    exit(1)

new_settings_ui = """                {/* Typ tłumaczenia (Klawiatura czy Układanka) */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-content-muted uppercase tracking-wider mb-4">
                    {language === 'pl' ? 'Sposób rozwiązywania' : 'Solving method'}
                  </label>
                  <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5">
                    <button
                      onClick={() => setExerciseFormat('typing')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        exerciseFormat === 'typing' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Keyboard className="w-4 h-4" />
                      {language === 'pl' ? 'Wpisywanie klawiaturą' : 'Keyboard typing'}
                    </button>
                    <button
                      onClick={() => setExerciseFormat('puzzle')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        exerciseFormat === 'puzzle' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Puzzle className="w-4 h-4" />
                      {language === 'pl' ? 'Układanka ze słów' : 'Word puzzle'}
                    </button>
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-bold text-content-muted uppercase tracking-wider mb-4">
                    {language === 'pl' ? 'Tryb nauki' : 'Practice mode'}
                  </label>
                  <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5">
                    <button
                      onClick={() => setPracticeMode('fixed')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        practiceMode === 'fixed' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      {language === 'pl' ? 'Na ilość zdań' : 'Fixed quantity'}
                    </button>
                    <button
                      onClick={() => setPracticeMode('time')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        practiceMode === 'time' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      {language === 'pl' ? 'Na czas (Wyzwanie)' : 'Time challenge'}
                    </button>
                  </div>
                </div>

                {practiceMode === 'fixed' && (
                  <div className="mb-6 relative">
                    <label className="flex items-center justify-between text-sm font-bold text-content-muted uppercase tracking-wider mb-8">
                      <span>{language === 'pl' ? 'Ilość zdań' : 'Number of sentences'}</span>
                      <div className="absolute right-0 -top-2">
                        <span ref={numSentencesRef} className="text-primary text-4xl font-black drop-shadow-[0_0_15px_rgba(114,240,180,0.5)] inline-block min-w-[3rem] text-center">
                          {numSentences}
                        </span>
                      </div>
                    </label>
                    <div className="relative pt-4 pb-2 px-2">
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={numSentences}
                        onChange={(e) => setNumSentences(parseInt(e.target.value))}
                        className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1</span>
                        <span>50</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {practiceMode === 'time' && (
                  <div className="mb-6 relative">
                    <label className="flex items-center justify-between text-sm font-bold text-content-muted uppercase tracking-wider mb-8">
                      <span>{language === 'pl' ? 'Czas na rozwiązanie (minuty)' : 'Time to solve (minutes)'}</span>
                      <div className="absolute right-0 -top-2">
                        <span ref={timeLimitRef} className="text-primary text-4xl font-black drop-shadow-[0_0_15px_rgba(114,240,180,0.5)] inline-block min-w-[3rem] text-center">
                          {timeLimit}
                        </span>
                      </div>
                    </label>
                    <div className="relative pt-4 pb-2 px-2">
                      <input
                        type="range"
                        min="1"
                        max="15"
                        step="1"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                        className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1 min</span>
                        <span>15 min</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

"""

code = code[:start_idx] + new_settings_ui + code[end_idx:]

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated settings UI successfully!")
