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
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-primary/10 border border-primary/30 p-6 rounded-2xl text-center shadow-lg">
            <h2 className="text-xl font-bold text-primary mb-2 flex justify-center items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {language === 'pl' ? 'Kreator ćwiczeń' : 'Exercise Creator'}
            </h2>
            <p className="text-sm text-primary/80">
              {language === 'pl' ? 'Przygotuj spersonalizowany test dla ucznia.' : 'Prepare a personalized test for the student.'}
            </p>
          </div>
          
          <div className="flex bg-base-200/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl mb-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] gap-1">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-500 relative ${
                activeTab === 'ai' 
                  ? 'text-primary bg-primary/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/30 backdrop-blur-md animate-pulsar' 
                  : 'text-content-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                {language === 'pl' ? 'Asystent budowania testów' : 'Test Building Assistant'}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('other')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-500 ${
                activeTab === 'other' 
                  ? 'text-white bg-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/20 backdrop-blur-md' 
                  : 'text-content-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-4 h-4" />
                {language === 'pl' ? 'Gotowe szablony ćwiczeń' : 'Ready exercise templates'}
              </div>
            </button>
          </div>
          
          {activeTab === 'ai' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Pane: Sources */}
              <Card className="p-6 md:p-8 space-y-6 border border-white/5 shadow-xl bg-base-200/40 backdrop-blur-xl relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {language === 'pl' ? 'Wybierz materiał' : 'Select material'}
                      </h2>
                      <p className="text-xs text-content-muted">
                        {language === 'pl' ? 'Kliknij w lekcje, aby dodać je do testu' : 'Click lessons to add them to the test'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {vocabularySets.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-content-muted mb-2">
                          {language === 'pl' ? 'Baza słownictwa z lekcji' : 'Vocabulary from lessons'}
                        </label>
                        <div className="flex flex-col gap-2">
                          {vocabularySets.map((set, idx) => {
                            const isSelected = selectedLessonIds.includes(set.id);
                            return (
                              <button 
                                key={set.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedLessonIds(prev => prev.filter(id => id !== set.id));
                                  } else {
                                    setSelectedLessonIds(prev => [...prev, set.id]);
                                    setSelectedSetId('general'); // clear standard selection if picking lessons
                                  }
                                }}
                                className={`text-left p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${isSelected ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-100/80 border-white/5 hover:border-primary/30 hover:bg-base-300/50'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-sm">
                                    <div className="font-bold text-base flex items-center gap-2">
                                      <span className="text-primary font-mono text-xs px-2 py-1 bg-primary/10 rounded-md">
                                        {language === 'pl' ? 'Lekcja' : 'Lesson'} {vocabularySets.length - idx}
                                      </span>
                                      {set.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()}
                                    </div>
                                    <div className="text-xs text-amber-500 italic mt-1">
                                      {new Date(set.date).toLocaleDateString()} &bull; {set.itemCount} {language === 'pl' ? 'słów' : 'words'}
                                    </div>
                                  </div>
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-black' : 'border-content-muted/30'}`}>
                                    {isSelected && <CheckCircle className="w-4 h-4" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-white/10 space-y-3 mt-4">
                       <label className="block text-sm font-bold text-content-muted mb-2">
                          {language === 'pl' ? 'Inne źródła (zastępuje wybrane lekcje)' : 'Other sources (overrides selected lessons)'}
                        </label>
                      <label className={`flex items-center gap-4 p-5 rounded-xl border transition-all cursor-pointer shadow-sm ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/50' : 'bg-base-200/60 backdrop-blur-md border-white/10 hover:border-primary/30'}`}>
                        <input 
                          type="radio" 
                          name="vocabSource" 
                          checked={selectedSetId === 'all' && selectedLessonIds.length === 0} 
                          onChange={() => { setSelectedSetId('all'); setSelectedLessonIds([]); }}
                          className="w-5 h-5 text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                        />
                        <div>
                          <div className="font-bold text-base">{language === 'pl' ? 'Wszystkie moje przypisane zestawy' : 'All my assigned word sets'}</div>
                          <div className="text-sm text-content-muted mt-0.5">{language === 'pl' ? `Wplecie słówka z Twoich ${availableSets.length} zestawów` : `Integrates terms from your ${availableSets.length} sets`}</div>
                        </div>
                      </label>
                      
                      {availableSets.length > 0 && (
                        <div className="border border-white/10 shadow-lg rounded-xl overflow-hidden bg-base-200/40 backdrop-blur-md">
                          <button
                            type="button"
                            className={`w-full flex items-center justify-between p-4 font-bold text-base transition-colors ${((selectedSetId !== 'all' && selectedSetId !== 'general') && selectedLessonIds.length === 0) ? 'bg-primary/5 text-primary' : 'hover:bg-base-300/50'}`}
                            onClick={() => setIsCustomSetsExpanded(!isCustomSetsExpanded)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">✏️</span>
                              {language === 'pl' ? 'Własne zestawy' : 'Custom sets'}
                            </div>
                            <motion.div
                              animate={{ rotate: isCustomSetsExpanded ? 180 : 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <ChevronDown className="w-5 h-5" />
                            </motion.div>
                          </button>
                          <AnimatePresence>
                            {isCustomSetsExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3 flex flex-col gap-2 border-t border-white/10 bg-base-200/30">
                                  {availableSets.map(set => {
                                    const isNewSet = set.title.toLowerCase().includes('nowy zestaw');
                                    const displayTitle = isNewSet && set.lessonTopic 
                                      ? (language === 'pl' ? `Słownictwo z: ${set.lessonTopic}` : `Vocabulary from: ${set.lessonTopic}`)
                                      : set.title;
                                    
                                    return (
                                      <label key={set.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${selectedSetId === set.id && selectedLessonIds.length === 0 ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/50' : 'bg-base-100/60 border-white/5 hover:border-primary/30'}`}>
                                        <input 
                                          type="radio" 
                                          name="vocabSource" 
                                          checked={selectedSetId === set.id && selectedLessonIds.length === 0} 
                                          onChange={() => { setSelectedSetId(set.id); setSelectedLessonIds([]); }}
                                          className="w-5 h-5 text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                                        />
                                        <div>
                                          <div className="font-bold text-base">{displayTitle}</div>
                                          {!isNewSet && set.lessonTopic && <div className="text-sm text-amber-500 italic mt-0.5">Topic: {set.lessonTopic}</div>}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Right Pane: Intelligent Assistant Settings */}
              <Card className="p-6 md:p-8 space-y-6 border border-white/5 shadow-xl bg-base-200/60 backdrop-blur-xl relative overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Settings className="w-6 h-6 animate-spin-slow" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {language === 'pl' ? 'Parametry testu' : 'Test parameters'}
                      </h2>
                      <p className="text-xs text-content-muted">
                        {language === 'pl' ? 'Skonfiguruj ustawienia asystenta' : 'Configure assistant settings'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    {(user?.role === 'admin' || user?.role === 'admin_student') ? (
                      <select 
                        value={level} 
                        onChange={(e) => setLevel(e.target.value)}
                        className="bg-base-300 border border-white/10 text-sm font-bold text-primary rounded-lg p-2 outline-none focus:border-primary/50 cursor-pointer"
                      >
                        {['A1', 'A2', 'A2/B1', 'B1', 'B1/B2', 'B2', 'B2/C1', 'C1', 'C2'].map((lvl) => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="bg-base-300 border border-white/10 text-sm font-bold text-primary rounded-lg p-2 cursor-default">
                        {level}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  {/* Selected Lessons Summary */}
                  {selectedLessonIds.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {language === 'pl' ? 'Wybrany zakres materiału:' : 'Selected material scope:'}
                      </h3>
                      <ul className="space-y-1">
                        {selectedLessonIds.map(id => {
                          const set = vocabularySets.find(s => s.id === id);
                          if (!set) return null;
                          return (
                            <li key={id} className="text-sm text-white/90 flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              {set.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Exercise Format */}
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-2">
                      {language === 'pl' ? 'Rodzaj ćwiczeń' : 'Exercise Type'}
                    </label>
                    <div className="flex rounded-lg overflow-hidden border border-base-300 bg-base-300/30">
                      <button
                        type="button"
                        onClick={() => setExerciseFormat('typing')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-bold transition-colors ${exerciseFormat === 'typing' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:bg-base-300/50'}`}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>{language === 'pl' ? 'Tłumaczenia' : 'Translations'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExerciseFormat('puzzle')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-bold transition-colors ${exerciseFormat === 'puzzle' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:bg-base-300/50'}`}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{language === 'pl' ? 'Układanka' : 'Puzzle'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Practice Mode */}
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-2">
                      {language === 'pl' ? 'Tryb nauki' : 'Practice Mode'}
                    </label>
                    <div className="flex rounded-lg overflow-hidden border border-base-300 bg-base-300/30">
                      <button
                        onClick={() => setPracticeMode('fixed')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${practiceMode === 'fixed' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:bg-base-300/50'}`}
                      >
                        <Hash className="w-4 h-4" />
                        {language === 'pl' ? 'Ilość zdań' : 'Fixed Amount'}
                      </button>
                      <button
                        onClick={() => setPracticeMode('time')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${practiceMode === 'time' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:bg-base-300/50'}`}
                      >
                        <Timer className="w-4 h-4" />
                        {language === 'pl' ? 'Na czas' : 'Time Challenge'}
                      </button>
                    </div>
                  </div>

                  {/* Amount / Time sliders */}
                  {practiceMode === 'fixed' ? (
                    <div>
                      <label className="flex items-center justify-between text-sm font-bold text-content-muted mb-2">
                        <span>{language === 'pl' ? 'Ilość ćwiczeń' : 'Number of exercises'}</span>
                        <span ref={numSentencesRef} className="text-primary font-bold bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(114,240,180,0.15)] px-3 py-1 rounded-xl text-lg font-mono min-w-[3rem] text-center inline-block">{numSentences}</span>
                      </label>
                      <div className="relative pt-2 pb-8 mt-2">
                        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-base-300/50 rounded-full -translate-y-1/2" />
                        <div 
                          className="absolute top-1/2 left-0 h-1.5 bg-primary rounded-full -translate-y-1/2 pointer-events-none transition-all duration-150"
                          style={{ width: `${(numSentences - 1) / 24 * 100}%` }}
                        />
                        <input 
                          type="range" min="1" max="25" value={numSentences}
                          onChange={(e) => setNumSentences(parseInt(e.target.value) || 1)}
                          className="w-full h-6 appearance-none cursor-pointer absolute top-1/2 -translate-y-1/2 opacity-0 z-20 m-0"
                        />
                        <div 
                          className="w-4 h-4 bg-primary rounded-full absolute top-1/2 -translate-y-1/2 z-10 shadow-[0_0_10px_rgba(114,240,180,0.5)] pointer-events-none transition-all duration-150"
                          style={{ left: `calc(${(numSentences - 1) / 24 * 100}% - 8px)` }}
                        >
                          <div className="absolute inset-0.5 bg-base-100 rounded-full"></div>
                          <div className="absolute inset-1.5 bg-primary rounded-full"></div>
                        </div>
                        <div className="absolute top-8 left-0 right-0 flex justify-between px-1 pointer-events-none">
                          {[1, 5, 10, 15, 20, 25].map(tick => (
                            <div key={tick} className="flex flex-col items-center absolute" style={{ left: `${(tick - 1) / 24 * 100}%`, transform: 'translateX(-50%)' }}>
                              <div className={`w-0.5 h-1.5 rounded-full mb-1 ${numSentences >= tick ? 'bg-primary' : 'bg-base-300'}`}></div>
                              <span className={`text-[10px] font-mono ${numSentences >= tick ? 'text-primary/80' : 'text-content-muted'}`}>{tick}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="flex items-center justify-between text-sm font-bold text-content-muted mb-2">
                        <span>{language === 'pl' ? 'Czas ćwiczenia (minuty)' : 'Practice time (minutes)'}</span>
                        <span ref={timeLimitRef} className="text-primary font-bold bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(114,240,180,0.15)] px-3 py-1 rounded-xl text-lg font-mono min-w-[4rem] text-center inline-block">{timeLimit} min</span>
                      </label>
                      <div className="relative pt-2 pb-8 mt-2">
                        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-base-300/50 rounded-full -translate-y-1/2" />
                        <div 
                          className="absolute top-1/2 left-0 h-1.5 bg-primary rounded-full -translate-y-1/2 pointer-events-none transition-all duration-150"
                          style={{ width: `${(timeLimit - 1) / 24 * 100}%` }}
                        />
                        <input 
                          type="range" min="1" max="25" value={timeLimit}
                          onChange={(e) => setTimeLimit(parseInt(e.target.value) || 1)}
                          className="w-full h-6 appearance-none cursor-pointer absolute top-1/2 -translate-y-1/2 opacity-0 z-20 m-0"
                        />
                        <div 
                          className="w-4 h-4 bg-primary rounded-full absolute top-1/2 -translate-y-1/2 z-10 shadow-[0_0_10px_rgba(114,240,180,0.5)] pointer-events-none transition-all duration-150"
                          style={{ left: `calc(${(timeLimit - 1) / 24 * 100}% - 8px)` }}
                        >
                          <div className="absolute inset-0.5 bg-base-100 rounded-full"></div>
                          <div className="absolute inset-1.5 bg-primary rounded-full"></div>
                        </div>
                        <div className="absolute top-8 left-0 right-0 flex justify-between px-1 pointer-events-none">
                          {[1, 5, 10, 15, 20, 25].map(tick => (
                            <div key={tick} className="flex flex-col items-center absolute" style={{ left: `${(tick - 1) / 24 * 100}%`, transform: 'translateX(-50%)' }}>
                              <div className={`w-0.5 h-1.5 rounded-full mb-1 ${timeLimit >= tick ? 'bg-primary' : 'bg-base-300'}`}></div>
                              <span className={`text-[10px] font-mono ${timeLimit >= tick ? 'text-primary/80' : 'text-content-muted'}`}>{tick}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Teacher Prompt Additions */}
                  {(user?.role === 'admin' || user?.role === 'admin_student') && (
                    <div className="pt-2">
                      <label className="block text-sm font-bold text-content-muted mb-2">
                        {language === 'pl' ? 'Instrukcje dodatkowe (Zakres materiału)' : 'Additional Instructions'}
                      </label>
                      <textarea
                        value={customGenPrompt}
                        onChange={(e) => setCustomGenPrompt(e.target.value)}
                        placeholder={language === 'pl' ? 'Np. Chciałbym sprawdzić kursanta pod kątem znajomości czasu Present Perfect...' : 'E.g. I would like to test the student on Present Perfect...'}
                        className="w-full h-24 bg-base-300 border border-white/10 rounded-xl p-3 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none resize-none"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-auto">
                  <AILoadingButton
                    isLoading={isLoading}
                    onClick={() => handleGenerate(false)}
                    className="w-full py-4 text-base font-bold shadow-lg shadow-primary/20"
                    loadingText={language === 'pl' ? 'Budowanie testu...' : 'Building test...'}
                  >
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    {language === 'pl' ? 'Generuj test przez AI' : 'Generate AI test'}
                  </AILoadingButton>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:border-primary transition-colors group"
                onClick={() => onStartPractice?.('intro')}
              >
                <div className="text-4xl mb-4">👀</div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Fiszki Intro' : 'Flashcards Intro'}
                </h3>
                <p className="text-content-muted text-sm">
                  {language === 'pl' ? 'Zapoznaj się powoli z nowym materiałem, bez sprawdzania i wyników.' : 'Familiarize yourself gently with new material, without testing or scoring.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer hover:border-primary transition-colors group"
                onClick={() => onStartPractice?.('flashcards')}
              >
                <div className="text-4xl mb-4">🎴</div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Fiszki' : 'Flashcards'}
                </h3>
                <p className="text-content-muted text-sm">
                  {language === 'pl' ? 'Przeglądaj pojęcia i definicje. Odwracaj karty, aby sprawdzić swoją wiedzę.' : 'Review terms and definitions. Flip cards to test your knowledge.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer hover:border-primary transition-colors group"
                onClick={() => onStartPractice?.('quiz')}
              >
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  Quiz
                </h3>
                <p className="text-content-muted text-sm">
                  {language === 'pl' ? 'Szybki test wielokrotnego wyboru. Sprawdź, ile pamiętasz.' : 'Quick multiple choice test. See how much you remember.'}
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

