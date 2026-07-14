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
                {language === 'pl' ? 'Tłumaczenie z AI' : 'AI Translation'}
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
                {language === 'pl' ? 'Pozostałe ćwiczenia' : 'Other exercises'}
              </div>
            </button>
          </div>

          {activeTab === 'ai' ? (
            <div className="space-y-6">
              <div className="text-center space-y-4 mb-10">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-[0_0_30px_rgba(114,240,180,0.2)]">
                   <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight">
                  {language === 'pl' ? 'Tłumaczenie Zdań z AI' : 'AI Sentence Translation'}
                </h2>
                <p className="text-lg text-content-muted max-w-2xl mx-auto">
                  {language === 'pl' 
                    ? 'Wybierz materiał, z którego chcesz ćwiczyć, a sztuczna inteligencja wygeneruje dla Ciebie spersonalizowane zdania do przetłumaczenia.' 
                    : 'Select the material you want to practice, and AI will generate personalized sentences for you to translate.'}
                </p>
              </div>

              <Card className="p-8 border border-white/10 shadow-2xl bg-base-200/50 backdrop-blur-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                  {language === 'pl' ? 'Z czego chcesz dzisiaj ćwiczyć?' : 'What do you want to practice today?'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <label className={`cursor-pointer group flex items-start gap-4 p-5 rounded-2xl border transition-all ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-300/50 border-white/5 hover:border-primary/30 hover:bg-base-300'}`}>
                    <input 
                      type="radio" 
                      name="materialSource" 
                      checked={selectedSetId === 'all' && selectedLessonIds.length === 0}
                      onChange={() => { setSelectedSetId('all'); setSelectedLessonIds([]); }}
                      className="mt-1 w-5 h-5 text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                    />
                    <div>
                      <div className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                        {language === 'pl' ? 'Wszystkie moje słówka' : 'All my vocabulary'}
                      </div>
                      <div className="text-sm text-content-muted">
                        {language === 'pl' ? 'AI dobierze słówka z całej Twojej historii nauki.' : 'AI will select words from your entire learning history.'}
                      </div>
                    </div>
                  </label>

                  <label className={`cursor-pointer group flex items-start gap-4 p-5 rounded-2xl border transition-all ${selectedSetId === 'general' && selectedLessonIds.length === 0 ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-300/50 border-white/5 hover:border-primary/30 hover:bg-base-300'}`}>
                    <input 
                      type="radio" 
                      name="materialSource" 
                      checked={selectedSetId === 'general' && selectedLessonIds.length === 0}
                      onChange={() => { setSelectedSetId('general'); setSelectedLessonIds([]); }}
                      className="mt-1 w-5 h-5 text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                    />
                    <div>
                      <div className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                        {language === 'pl' ? 'Rozmówki ogólne' : 'General conversation'}
                      </div>
                      <div className="text-sm text-content-muted">
                        {language === 'pl' ? 'Praktyczne zdania z życia codziennego dopasowane do Twojego poziomu.' : 'Practical everyday sentences matched to your level.'}
                      </div>
                    </div>
                  </label>
                </div>

                {vocabularySets.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-sm font-bold text-content-muted uppercase tracking-wider mb-4">
                      {language === 'pl' ? 'Albo wybierz konkretne lekcje:' : 'Or choose specific lessons:'}
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {vocabularySets.map((set, index) => {
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
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                              isSelected 
                                ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30' 
                                : 'bg-base-300/40 border-white/5 hover:border-primary/30 hover:bg-base-300/80'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${isSelected ? 'bg-primary text-black' : 'bg-base-100 text-content-muted'}`}>
                                #{lessonNumber}
                              </div>
                              <div className="text-left">
                                <div className={`font-bold ${isSelected ? 'text-white' : 'text-content-muted'}`}>
                                  {set.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()}
                                </div>
                                <div className="text-xs text-primary/70 mt-1">
                                  {new Date(set.date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-black' : 'border-white/20'}`}>
                              {isSelected && <CheckCircle className="w-4 h-4" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-white/10">
                  <AILoadingButton 
                    onClick={() => handleGenerate(false)} 
                    isLoading={isLoading}
                    loadingText={language === 'pl' ? 'AI przygotowuje ćwiczenie...' : 'AI is preparing the exercise...'}
                    className="w-full py-5 text-xl font-black bg-primary text-black hover:bg-primary/90 shadow-[0_0_40px_rgba(114,240,180,0.3)] transition-all hover:scale-[1.02] rounded-2xl"
                  >
                    <Sparkles className="w-6 h-6 mr-2" />
                    {language === 'pl' ? 'Generuj ćwiczenie' : 'Generate exercise'}
                  </AILoadingButton>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
