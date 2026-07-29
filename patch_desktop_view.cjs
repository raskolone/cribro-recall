const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetDesktop = `                  <div className="hidden md:block space-y-7 animate-fade-in-up">
                    {/* Title & Subtitle */}
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {language === 'pl' ? 'Konfiguracja Treningu' : 'Training Configuration'}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1 font-normal">
                        {language === 'pl' ? 'Dostosuj parametry wyzwania i rozpocznij sesję AI.' : 'Customize challenge parameters and launch AI session.'}
                      </p>
                    </div>

                    {/* Unified Źródło Słownictwa Box */}
                      <div>
                        <button 
                          type="button"
                          onClick={() => setIsLessonSelectorOpen(true)}
                          className="w-full bg-[#131b26] border border-white/10 hover:border-white/20 transition-colors rounded-2xl p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm font-semibold text-white">
                              {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary source'}
                            </span>
                          </div>
                          <ChevronDown className={\`w-5 h-5 text-gray-400 transition-transform duration-300 \${isLessonSelectorOpen ? 'rotate-180' : ''}\`} />
                        </button>
                        <div className="mt-2 px-2 text-[10px] text-gray-400 font-medium whitespace-pre-wrap leading-relaxed">
                          
                          {selectedSetId === 'grammar' && selectedGrammarTopic ? (language === 'pl' ? \`Gramatyka \${selectedGrammarTopic.chapterIndex + 1} - \${selectedGrammarTopic.name}\` : \`Grammar \${selectedGrammarTopic.chapterIndex + 1} - \${selectedGrammarTopic.name}\`) :
                           selectedSetId === 'all' && selectedLessonIds.length === 0 ? (language === 'pl' ? 'Wybrano: Wszystkie słówka (Mix)' : 'Selected: All vocab') : 

                           selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? (language === 'pl' ? \`Wybrane lekcje: \${vocabularySets.filter(s => selectedLessonIds.includes(s.id)).map(s => s.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()).join(', ')}\` : \`Selected lessons: \${selectedLessonIds.length}\`) : 
                           specialTasks.find(t => 'special-task-' + t.id === selectedSetId) ? (language === 'pl' ? 'Wybrano: Zadanie specjalne' : 'Selected: Special Task') : ''}
                        </div>
                      </div>

                    {/* SECTION 2: TRYB ĆWICZENIA */}
                    <div className="space-y-3">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {language === 'pl' ? 'Tryb ćwiczenia' : 'Exercise mode'}
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Card 1: Rozgrzewka */}
                        <div
                          onClick={() => setExerciseFormat('puzzle')}
                          className={\`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer relative \${
                            exerciseFormat === 'puzzle'
                              ? 'border-emerald-500/60 bg-gradient-to-br from-[#0e2722] via-[#102026] to-[#121b27] shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20'
                          }\`}
                        >
                          {exerciseFormat === 'puzzle' && (
                            <div className="absolute top-4 right-4 flex items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                            </div>
                          )}
                          <h4 className="text-base font-bold text-white mb-1">
                            {language === 'pl' ? 'Układanka' : 'Puzzle'}
                          </h4>
                          <p className="text-xs text-gray-400 leading-relaxed font-normal pr-4">
                            {language === 'pl' 
                              ? 'Układaj rozrzucone słowa we właściwej kolejności.'
                              : 'Arrange scattered words in the correct order.'}
                          </p>
                        </div>

                        {/* Card 2: Prawdziwe Wyzwanie */}
                        <div
                          onClick={() => setExerciseFormat('typing')}
                          className={\`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer relative \${
                            exerciseFormat === 'typing'
                              ? 'border-emerald-500/60 bg-gradient-to-br from-[#0e2722] via-[#102026] to-[#121b27] shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20'
                          }\`}
                        >
                          {exerciseFormat === 'typing' && (
                            <div className="absolute top-4 right-4 flex items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                            </div>
                          )}
                          <h4 className="text-base font-bold text-white mb-1">
                            {language === 'pl' ? 'Prawdziwe Wyzwanie' : 'Real Challenge'}
                          </h4>
                          <p className="text-xs text-gray-400 leading-relaxed font-normal pr-4">
                            {language === 'pl' 
                              ? 'Wpisuj całe zdania z klawiatury. Weryfikacja błędów przez AI.'
                              : 'Type full sentences with keyboard. AI error verification.'}
                          </p>
                        </div>
                      </div>
                    </div>`;

const repDesktop = `                  <div className="hidden md:block space-y-7 animate-fade-in-up">
                    {/* Title */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {language === 'pl' ? 'Czas na trening' : 'Time for training'}
                      </h2>
                    </div>

                    {/* SECTION 2: TRYB ĆWICZENIA (Two large tiles) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Card 1: Układanka */}
                      <button
                        type="button"
                        onClick={() => setExerciseFormat('puzzle')}
                        className={\`relative aspect-square sm:aspect-auto sm:h-48 rounded-[2rem] flex flex-col items-center justify-center transition-all duration-500 overflow-hidden \${
                          exerciseFormat === 'puzzle'
                            ? 'bg-gradient-to-br from-[#10b981]/20 to-[#090d16] border-[0.5px] border-[#10b981]/50 shadow-[0_0_30px_rgba(16,185,129,0.3),inset_0_2px_15px_rgba(16,185,129,0.4)]'
                            : 'bg-gradient-to-br from-white/5 to-transparent border-[0.5px] border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] hover:border-white/20'
                        }\`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-[2rem]"></div>
                        <LayoutGrid className={\`w-10 h-10 mb-3 z-10 \${exerciseFormat === 'puzzle' ? 'text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-gray-400'}\`} />
                        <span className={\`text-sm font-bold z-10 \${exerciseFormat === 'puzzle' ? 'text-white' : 'text-gray-400'}\`}>{language === 'pl' ? 'Układanka' : 'Puzzle'}</span>
                        {exerciseFormat === 'puzzle' && (
                          <div className="absolute top-4 right-4 flex items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                          </div>
                        )}
                      </button>

                      {/* Card 2: Prawdziwe wyzwanie */}
                      <button
                        type="button"
                        onClick={() => setExerciseFormat('typing')}
                        className={\`relative aspect-square sm:aspect-auto sm:h-48 rounded-[2rem] flex flex-col items-center justify-center transition-all duration-500 overflow-hidden \${
                          exerciseFormat === 'typing'
                            ? 'bg-gradient-to-br from-[#10b981]/20 to-[#090d16] border-[0.5px] border-[#10b981]/50 shadow-[0_0_30px_rgba(16,185,129,0.3),inset_0_2px_15px_rgba(16,185,129,0.4)]'
                            : 'bg-gradient-to-br from-white/5 to-transparent border-[0.5px] border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] hover:border-white/20'
                        }\`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-[2rem]"></div>
                        <Keyboard className={\`w-10 h-10 mb-3 z-10 \${exerciseFormat === 'typing' ? 'text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-gray-400'}\`} />
                        <span className={\`text-sm font-bold z-10 \${exerciseFormat === 'typing' ? 'text-white' : 'text-gray-400'}\`}>{language === 'pl' ? 'Prawdziwe Wyzwanie' : 'Real Challenge'}</span>
                        {exerciseFormat === 'typing' && (
                          <div className="absolute top-4 right-4 flex items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Unified Źródło Słownictwa Box */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                        {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary source'}
                      </label>
                      <button 
                        type="button"
                        onClick={() => setIsLessonSelectorOpen(true)}
                        className="w-full bg-[#131b26] border border-white/10 hover:border-white/20 transition-colors rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm font-semibold text-white">
                            {language === 'pl' ? 'Wybierz lekcje' : 'Choose lessons'}
                          </span>
                        </div>
                        <ChevronDown className={\`w-5 h-5 text-gray-400 transition-transform duration-300 \${isLessonSelectorOpen ? 'rotate-180' : ''}\`} />
                      </button>
                      <div className="mt-2 px-2 text-[10px] text-gray-400 font-medium whitespace-pre-wrap leading-relaxed">
                          
                        {selectedSetId === 'grammar' && selectedGrammarTopic ? (language === 'pl' ? \`Gramatyka \${selectedGrammarTopic.chapterIndex + 1} - \${selectedGrammarTopic.name}\` : \`Grammar \${selectedGrammarTopic.chapterIndex + 1} - \${selectedGrammarTopic.name}\`) :
                         selectedSetId === 'all' && selectedLessonIds.length === 0 ? (language === 'pl' ? 'Wybrano: Wszystkie słówka (Mix)' : 'Selected: All vocab') : 

                         selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? (language === 'pl' ? \`Wybrane lekcje: \${vocabularySets.filter(s => selectedLessonIds.includes(s.id)).map(s => s.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()).join(', ')}\` : \`Selected lessons: \${selectedLessonIds.length}\`) : 
                         specialTasks.find(t => 'special-task-' + t.id === selectedSetId) ? (language === 'pl' ? 'Wybrano: Zadanie specjalne' : 'Selected: Special Task') : ''}
                      </div>
                    </div>`;

if (content.includes(targetDesktop)) {
  content = content.replace(targetDesktop, repDesktop);
  fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
  console.log("Patched successfully!");
} else {
  console.log("Could not find target block!");
}
