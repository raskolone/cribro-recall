import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

start_marker = "      {step === 'setup' && ("
end_marker = "      {step === 'practice' && exercises.length > 0 && ("

start_idx = code.find(start_marker)
end_idx = code.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    exit(1)

new_setup_ui = """      {step === 'setup' && (
        <div className="max-w-4xl mx-auto space-y-8 mt-4">
          {/* Main Tabs */}
          <div className="flex bg-base-200/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl mb-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] gap-1">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-4 px-6 rounded-xl text-base font-bold transition-all duration-500 relative ${
                activeTab === 'ai' 
                  ? 'text-primary bg-primary/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/30 backdrop-blur-md animate-pulsar' 
                  : 'text-content-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                {language === 'pl' ? 'Tłumaczenie zdań' : 'Sentence Translation'}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('other')}
              className={`flex-1 py-4 px-6 rounded-xl text-base font-bold transition-all duration-500 ${
                activeTab === 'other' 
                  ? 'text-white bg-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/20 backdrop-blur-md' 
                  : 'text-content-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5" />
                {language === 'pl' ? 'Inne ćwiczenia' : 'Other exercises'}
              </div>
            </button>
          </div>

          {activeTab === 'ai' ? (
            <div className="space-y-8 animate-fade-in-up">
              {/* Removed the description and title as requested */}

              <Card className="p-0 border border-primary/20 shadow-[0_0_20px_rgba(114,240,180,0.1)] bg-base-200/40 backdrop-blur-xl relative overflow-hidden flex flex-col">
                <div className="p-6 border-b border-primary/10 bg-primary/5">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-primary">
                    <BookOpen className="w-6 h-6" />
                    {language === 'pl' ? 'Wybierz źródło słownictwa' : 'Select vocabulary source'}
                  </h3>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Główny wybór opcji */}
                  <div className="space-y-3">
                    {/* Opcja 1: Lekcje */}
                    <div className="border border-primary/20 rounded-xl overflow-hidden bg-base-200/50">
                      <button 
                        className={`w-full flex items-center justify-between p-4 transition-colors ${selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? 'bg-primary/20' : 'hover:bg-primary/5'}`}
                        onClick={() => {
                          if (selectedSetId !== 'lessons') {
                            setSelectedSetId('lessons');
                            if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                              setSelectedLessonIds([vocabularySets[0].id]);
                            }
                          } else {
                            setSelectedSetId('');
                            setSelectedLessonIds([]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${(selectedSetId === 'lessons' || selectedLessonIds.length > 0) ? 'border-primary bg-primary text-black' : 'border-primary/50'}`}>
                            {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                          </div>
                          <span className="font-bold text-lg">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</span>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-transform ${(selectedSetId === 'lessons' || selectedLessonIds.length > 0) ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Rozwijana lista lekcji */}
                      {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && (
                        <div className="p-4 border-t border-primary/20 bg-base-100/30 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                          {vocabularySets.length > 0 ? vocabularySets.map((set, index) => {
                            const isSelected = selectedLessonIds.includes(set.id);
                            const lessonNumber = vocabularySets.length - index;
                            return (
                              <label key={set.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-primary/20 border-primary/50' : 'bg-base-200/50 border-white/5 hover:border-primary/30'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedLessonIds(prev => prev.filter(id => id !== set.id));
                                    } else {
                                      setSelectedLessonIds(prev => [...prev, set.id]);
                                    }
                                  }}
                                  className="w-4 h-4 text-primary focus:ring-primary rounded border-white/20 bg-base-300"
                                />
                                <div className="flex flex-col">
                                  <span className={isSelected ? 'text-white font-medium' : 'text-content-muted'}>
                                    <span className="text-xs font-mono opacity-70 mr-2">L{lessonNumber}</span>
                                    {set.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()}
                                  </span>
                                </div>
                              </label>
                            );
                          }) : (
                            <div className="text-center text-sm text-content-muted p-4">
                              {language === 'pl' ? 'Brak dostępnych lekcji' : 'No lessons available'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Opcja 2: Wszystkie moje słówka */}
                    <button 
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-200/50 border-primary/20 hover:bg-primary/5'}`}
                      onClick={() => { setSelectedSetId('all'); setSelectedLessonIds([]); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${(selectedSetId === 'all' && selectedLessonIds.length === 0) ? 'border-primary bg-primary text-black' : 'border-primary/50'}`}>
                          {(selectedSetId === 'all' && selectedLessonIds.length === 0) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                        </div>
                        <span className="font-bold text-lg">{language === 'pl' ? 'Wszystkie moje słówka (Mix)' : 'All my vocabulary (Mix)'}</span>
                      </div>
                    </button>

                    {/* Opcja 3: Losowe zdania */}
                    <button 
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedSetId === 'random' && selectedLessonIds.length === 0 ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-200/50 border-primary/20 hover:bg-primary/5'}`}
                      onClick={() => { setSelectedSetId('random'); setSelectedLessonIds([]); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${(selectedSetId === 'random' && selectedLessonIds.length === 0) ? 'border-primary bg-primary text-black' : 'border-primary/50'}`}>
                          {(selectedSetId === 'random' && selectedLessonIds.length === 0) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                        </div>
                        <span className="font-bold text-lg">{language === 'pl' ? 'Losowe zdania' : 'Random sentences'}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </Card>

              {/* Parametry ćwiczenia: Tryb, Suwak itp. */}
              <Card className="p-6 border border-primary/20 shadow-[0_0_20px_rgba(114,240,180,0.1)] bg-base-200/40 backdrop-blur-xl relative overflow-hidden">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-primary">
                  <Settings className="w-6 h-6" />
                  {language === 'pl' ? 'Ustawienia ćwiczenia' : 'Exercise settings'}
                </h3>

                {/* Typ tłumaczenia (Klawiatura czy Układanka) */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-content-muted uppercase tracking-wider mb-4">
                    {language === 'pl' ? 'Sposób rozwiązywania' : 'Solving method'}
                  </label>
                  <div className="flex bg-base-300/50 p-1.5 rounded-xl border border-primary/10">
                    <button
                      onClick={() => setExerciseFormat('typing')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        exerciseFormat === 'typing' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-content-muted hover:text-white'
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
                          : 'text-content-muted hover:text-white'
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
                  <div className="flex bg-base-300/50 p-1.5 rounded-xl border border-primary/10">
                    <button
                      onClick={() => setPracticeMode('fixed')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        practiceMode === 'fixed' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-content-muted hover:text-white'
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
                          : 'text-content-muted hover:text-white'
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
                        <span ref={numSentencesRef} className="text-primary text-3xl font-black drop-shadow-[0_0_15px_rgba(114,240,180,0.5)] inline-block min-w-[2rem] text-center">
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
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                        <span ref={timeLimitRef} className="text-primary text-3xl font-black drop-shadow-[0_0_15px_rgba(114,240,180,0.5)] inline-block min-w-[2rem] text-center">
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
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1 min</span>
                        <span>15 min</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <div className="pt-4">
                <AILoadingButton 
                  onClick={() => handleGenerate(false)} 
                  isLoading={isLoading}
                  loadingText={language === 'pl' ? 'AI przygotowuje ćwiczenie...' : 'AI is preparing the exercise...'}
                  className="w-full py-5 text-xl font-black bg-primary text-black hover:bg-primary/90 shadow-[0_0_40px_rgba(114,240,180,0.3)] transition-all hover:scale-[1.02] rounded-2xl"
                >
                  <Sparkles className="w-6 h-6 mr-2" />
                  {language === 'pl' ? 'Wygeneruj zadanie' : 'Generate exercise'}
                </AILoadingButton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 animate-fade-in-up">
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('intro')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">👀</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Fiszki Intro' : 'Flashcards Intro'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Zapoznaj się powoli z nowym materiałem, bez sprawdzania i wyników.' : 'Familiarize yourself gently with new material, without testing or scoring.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('flashcards')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🗂️</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Fiszki' : 'Flashcards'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Przeglądaj pojęcia i definicje. Odwracaj karty, aby sprawdzić swoją wiedzę.' : 'Review terms and definitions. Flip cards to test your knowledge.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('quiz')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">📝</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Quiz' : 'Quiz'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Szybki test wielokrotnego wyboru. Sprawdź, ile pamiętasz.' : 'Quick multiple choice test. See how much you remember.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('match')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🧩</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Dopasowania' : 'Match'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Połącz słowo z jego definicją lub tłumaczeniem.' : 'Connect a word with its definition or translation.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group md:col-span-2"
                onClick={() => onStartPractice?.('fill-in-the-blank')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">✍️</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Pisanie (Wypełnianie luk)' : 'Writing (Fill in the blank)'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Wpisz brakujące słowo w zdaniu z kontekstem. Świetne do nauki pisowni.' : 'Type the missing word in a contextual sentence. Great for spelling.'}
                </p>
              </Card>
            </div>
          )}
        </div>
      )}
"""

code = code[:start_idx] + new_setup_ui + code[end_idx:]

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated UI successfully!")
