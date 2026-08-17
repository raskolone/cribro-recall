import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r') as f:
    content = f.read()

# Add Option 5
option_4_end = "                                      <div className=\"text-center text-xs text-gray-400 py-3\">Brak dodanych lekcji</div>\n                                    )}"

option_5_content = """                                    )}

                                    {/* Option 5: Słownictwo prywatne (Flashcards) */}
                                    {availableSets.length > 0 && (
                                      <div className="pt-2 space-y-2 border-t border-white/5 mt-2">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1 pt-1">
                                          {language === 'pl' ? 'Słownictwo prywatne:' : 'Private vocabulary:'}
                                        </p>
                                        {availableSets.map((set) => {
                                          const isSelected = selectedSetId === set.id;
                                          return (
                                            <label 
                                              key={set.id} 
                                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                                isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5 hover:border-white/10'
                                              }`}
                                            >
                                              <input 
                                                type="radio"
                                                name="vocabSourceRadio"
                                                checked={isSelected}
                                                onChange={() => {
                                                  setSelectedSetId(set.id);
                                                  setSelectedLessonIds([]);
                                                }}
                                                className="w-4 h-4 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                              />
                                              <div className="flex-1 flex flex-col min-w-0 gap-0.5">
                                                <span className={`text-xs font-semibold leading-relaxed ${isSelected ? 'text-emerald-400' : 'text-gray-300'} break-words`}>
                                                  {set.title}
                                                </span>
                                              </div>
                                              <span className="text-[10px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded">
                                                {set.cardCount}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}"""

content = content.replace(option_4_end, option_5_content)

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w') as f:
    f.write(content)

