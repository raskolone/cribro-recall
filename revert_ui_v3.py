import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

start_marker = "      {step === 'setup' && ("
end_marker = "      {step === 'practice' && exercises.length > 0 && ("

start_idx = code.find(start_marker)
end_idx = code.find(end_marker)

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
              <div className="text-center space-y-4 mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight">
                  {language === 'pl' ? 'Tłumaczenie Zdań z AI' : 'AI Sentence Translation'}
                </h2>
                <p className="text-lg text-content-muted max-w-2xl mx-auto">
                  {language === 'pl' 
                    ? 'Wybierz lekcję lub temat, a sztuczna inteligencja wygeneruje dla Ciebie spersonalizowane zdania do przetłumaczenia.' 
                    : 'Select a lesson or topic, and AI will generate personalized sentences for you to translate.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Źródło słownictwa (Lekcje) */}
                <Card className="p-0 border border-white/5 shadow-xl bg-base-200/40 backdrop-blur-xl relative overflow-hidden flex flex-col h-full">
                  <div className="p-6 border-b border-white/5 bg-base-200/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          {language === 'pl' ? 'Lekcje' : 'Lessons'}
                        </h3>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar max-h-[300px]">
                    {vocabularySets.length > 0 ? vocabularySets.map((set, index) => {
                      const isSelected = selectedLessonIds.includes(set.id);
                      const lessonNumber = vocabularySets.length - index;
                      return (
                        <button
                          key={set.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedLessonIds(prev => prev.filter(id => id !== set.id));
                            } else {
                              setSelectedLessonIds(prev => [...prev, set.id]);
                              setSelectedSetId('lessons');
                            }
                          }}
                          className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                            isSelected 
                              ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' 
                              : 'bg-base-100/30 border-white/5 hover:border-primary/30 hover:bg-base-300/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-[15px] flex items-center gap-2">
                                <span className={`font-mono text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-bold ${isSelected ? 'bg-primary text-black' : 'bg-white/10 text-content-muted'}`}>
                                  {language === 'pl' ? 'Lekcja' : 'Lesson'} {lessonNumber}
                                </span>
                                <span className={isSelected ? 'text-white' : 'text-content-muted group-hover:text-white transition-colors line-clamp-1'}>
                                  {set.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()}
                                </span>
                              </div>
                            </div>
                            <div className={`flex-shrink-0 ml-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-black' : 'border-content-muted/30'}`}>
                              {isSelected && <CheckCircle className="w-3 h-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    }) : (
                       <div className="text-center text-content-muted p-8 text-sm">
                         {language === 'pl' ? 'Brak dostępnych lekcji' : 'No lessons available'}
                       </div>
                    )}
                  </div>
                </Card>

                {/* Losowe słowa / Inne tematy */}
                <Card className="p-0 border border-white/5 shadow-xl bg-base-200/40 backdrop-blur-xl relative overflow-hidden flex flex-col h-full">
                  <div className="p-6 border-b border-white/5 bg-base-200/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          {language === 'pl' ? 'Inne opcje' : 'Other options'}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-4 space-y-3">
                    <button
                      onClick={() => { setSelectedSetId('all'); setSelectedLessonIds([]); setTestName(''); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                        selectedSetId === 'all' && selectedLessonIds.length === 0
                          ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' 
                          : 'bg-base-100/30 border-white/5 hover:border-primary/30 hover:bg-base-300/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-bold text-[15px] ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'text-white' : 'text-content-muted'}`}>
                            {language === 'pl' ? 'Wszystkie moje słówka (Mix)' : 'All my vocabulary (Mix)'}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'border-primary bg-primary text-black' : 'border-content-muted/30'}`}>
                          {selectedSetId === 'all' && selectedLessonIds.length === 0 && <CheckCircle className="w-3 h-3" />}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => { setSelectedSetId('random'); setSelectedLessonIds([]); setTestName(''); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                        selectedSetId === 'random' && selectedLessonIds.length === 0
                          ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' 
                          : 'bg-base-100/30 border-white/5 hover:border-primary/30 hover:bg-base-300/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-bold text-[15px] ${selectedSetId === 'random' && selectedLessonIds.length === 0 ? 'text-white' : 'text-content-muted'}`}>
                            {language === 'pl' ? 'Losowe zdania' : 'Random sentences'}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedSetId === 'random' && selectedLessonIds.length === 0 ? 'border-primary bg-primary text-black' : 'border-content-muted/30'}`}>
                          {selectedSetId === 'random' && selectedLessonIds.length === 0 && <CheckCircle className="w-3 h-3" />}
                        </div>
                      </div>
                    </button>
                    
                    <div className="pt-4 mt-2 border-t border-white/5">
                      <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
                        {language === 'pl' ? 'Konkretny temat (opcjonalnie)' : 'Specific topic (optional)'}
                      </label>
                      <input
                        type="text"
                        value={testName}
                        onChange={(e) => {
                           setTestName(e.target.value);
                           if (e.target.value.trim() !== '') {
                              setSelectedSetId('custom_topic');
                              setSelectedLessonIds([]);
                           } else if (selectedSetId === 'custom_topic') {
                              setSelectedSetId('all');
                           }
                        }}
                        placeholder={language === 'pl' ? 'np. Podróże, Praca, Historia...' : 'e.g. Travel, Work, History...'}
                        className={`w-full bg-base-300/30 border rounded-xl p-3.5 text-sm focus:outline-none transition-colors ${
                          selectedSetId === 'custom_topic' ? 'border-primary/50 ring-1 ring-primary/30 text-white' : 'border-white/10 text-content-muted focus:border-primary/30'
                        }`}
                      />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="pt-6">
                <AILoadingButton 
                  onClick={() => handleGenerate(false)} 
                  isLoading={isLoading}
                  loadingText={language === 'pl' ? 'AI przygotowuje zdania...' : 'AI is preparing sentences...'}
                  className="w-full py-5 text-xl font-black bg-primary text-black hover:bg-primary/90 shadow-[0_0_40px_rgba(114,240,180,0.3)] transition-all hover:scale-[1.02] rounded-2xl"
                >
                  <Sparkles className="w-6 h-6 mr-2" />
                  {language === 'pl' ? 'Generuj ćwiczenie' : 'Generate exercise'}
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
