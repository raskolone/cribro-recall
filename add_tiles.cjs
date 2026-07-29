const fs = require('fs');
let file = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// Find the mobile section closing div
const mobileClosing = `                    </div>

                    {/* Unified Źródło Słownictwa Box */}`;

const mobileReplacement = `                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                      {/* Card 3: Fiszki */}
                      <button
                        type="button"
                        onClick={() => handleStartOtherPractice('flashcards')}
                        className="relative aspect-auto h-24 rounded-[2rem] flex flex-col items-center justify-center gap-1 transition-all duration-500 overflow-hidden bg-gradient-to-br from-white/5 to-transparent border-[0.5px] border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] hover:border-white/20"
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-[2rem]"></div>
                        <div className="text-2xl shrink-0 z-10">🗂️</div>
                        <span className="text-[11px] font-bold z-10 text-gray-400">{language === 'pl' ? 'Fiszki' : 'Flashcards'}</span>
                      </button>
                      
                      {/* Card 4: Dopasowanie */}
                      <button
                        type="button"
                        onClick={() => handleStartOtherPractice('match')}
                        className="relative aspect-auto h-24 rounded-[2rem] flex flex-col items-center justify-center gap-1 transition-all duration-500 overflow-hidden bg-gradient-to-br from-white/5 to-transparent border-[0.5px] border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] hover:border-white/20"
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-[2rem]"></div>
                        <div className="text-2xl shrink-0 z-10">🧩</div>
                        <span className="text-[11px] font-bold z-10 text-gray-400">{language === 'pl' ? 'Dopasowanie' : 'Match'}</span>
                      </button>
                    </div>

                    {/* Unified Źródło Słownictwa Box */}`;

file = file.replace(mobileClosing, mobileReplacement);


// Find desktop section closing div
const desktopClosing = `                          </button>
                        </div>
                      </div>

                      {/* Unified Źródło Słownictwa Box */}`;

const desktopReplacement = `                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {/* Card 3: Fiszki */}
                          <button
                            type="button"
                            onClick={() => handleStartOtherPractice('flashcards')}
                            className="relative aspect-auto h-24 rounded-[2rem] flex flex-col items-center justify-center gap-1 transition-all duration-500 overflow-hidden bg-gradient-to-br from-white/5 to-transparent border-[0.5px] border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] hover:border-white/20"
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-[2rem]"></div>
                            <div className="text-2xl shrink-0 z-10">🗂️</div>
                            <span className="text-[11px] font-bold z-10 text-gray-400">{language === 'pl' ? 'Fiszki' : 'Flashcards'}</span>
                          </button>
                          
                          {/* Card 4: Dopasowanie */}
                          <button
                            type="button"
                            onClick={() => handleStartOtherPractice('match')}
                            className="relative aspect-auto h-24 rounded-[2rem] flex flex-col items-center justify-center gap-1 transition-all duration-500 overflow-hidden bg-gradient-to-br from-white/5 to-transparent border-[0.5px] border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] hover:border-white/20"
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-[2rem]"></div>
                            <div className="text-2xl shrink-0 z-10">🧩</div>
                            <span className="text-[11px] font-bold z-10 text-gray-400">{language === 'pl' ? 'Dopasowanie' : 'Match'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Unified Źródło Słownictwa Box */}`;

file = file.replace(desktopClosing, desktopReplacement);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', file);
