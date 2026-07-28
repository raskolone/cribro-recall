const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Remove Sphere 2 and Sphere 3
code = code.replace(
  /\s*\{\/\* Sphere 2: Szybki Test \*\/\}[\s\S]*?\{\/\* Sphere 4: Prawdziwe Wyzwanie \*\/\}/,
  "\n                          {/* Sphere 4: Prawdziwe Wyzwanie */}"
);

// 2. Replace the Expandable Lesson Selection for Mobile
code = code.replace(
  /\{\/\* Expandable Lesson Selection for Mobile \*\/\}[\s\S]*?<\/AnimatePresence>/,
  `{/* Modal Lesson Selection for Mobile */}
                        <AnimatePresence>
                          {isLessonSelectorOpen && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-6"
                            >
                              <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-[#0f1522] border border-white/10 w-full max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                              >
                                <div className="flex justify-between items-center mb-6">
                                  <h3 className="text-lg font-bold text-white">
                                    {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary source'}
                                  </h3>
                                  <button 
                                    onClick={() => setIsLessonSelectorOpen(false)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                
                                <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2 space-y-2 pb-6">
                                  {/* Option to select "All" */}
                                  <label className={\`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer \${
                                    selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                  }\`}>
                                    <input 
                                      type="radio" 
                                      name="mobileSourceModal"
                                      checked={selectedSetId === 'all' && selectedLessonIds.length === 0}
                                      onChange={() => {
                                        setSelectedSetId('all');
                                        setSelectedLessonIds([]);
                                      }}
                                      className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                    />
                                    <span className={\`text-base font-semibold \${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'text-emerald-400' : 'text-gray-300'}\`}>
                                      {language === 'pl' ? 'Wszystkie słówka (Mix)' : 'All vocabulary'}
                                    </span>
                                  </label>
                                  
                                  <div className="h-px w-full bg-white/10 my-4"></div>

                                  {vocabularySets.length > 0 ? vocabularySets.map((set, index) => {
                                    const isSelected = selectedLessonIds.includes(set.id);
                                    const lessonNumber = vocabularySets.length - index;
                                    return (
                                      <label 
                                        key={set.id} 
                                        className={\`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer \${
                                          isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                        }\`}
                                      >
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => {
                                            setSelectedSetId('lessons');
                                            if (isSelected) {
                                              setSelectedLessonIds(prev => prev.filter(id => id !== set.id));
                                            } else {
                                              setSelectedLessonIds(prev => [...prev, set.id]);
                                            }
                                          }}
                                          className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                        />
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-semibold leading-none flex items-center flex-wrap gap-y-2">
                                            <span className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded text-emerald-300 mr-2 border border-white/5">L{lessonNumber}</span>
                                            <span className={\`\${isSelected ? 'text-white' : 'text-gray-300'} break-words whitespace-normal leading-tight\`}>
                                              {set.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()}
                                            </span>
                                          </span>
                                        </div>
                                      </label>
                                    );
                                  }) : (
                                    <div className="text-center text-sm text-gray-400 py-8">Brak lekcji</div>
                                  )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10">
                                  <button 
                                    onClick={() => setIsLessonSelectorOpen(false)}
                                    className="w-full py-4 rounded-2xl bg-[#10b981] text-black font-bold text-base shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                  >
                                    {language === 'pl' ? 'Zatwierdź' : 'Confirm'}
                                  </button>
                                </div>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
