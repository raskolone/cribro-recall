const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Add state for selectedGrammarTopic and expandedGrammarLevel
const stateVars = `
  const [selectedGrammarTopic, setSelectedGrammarTopic] = useState<any>(null);
  const [expandedGrammarLevel, setExpandedGrammarLevel] = useState<number | null>(null);
`;
code = code.replace(/const \[isLessonSelectorOpen, setIsLessonSelectorOpen\] = useState\(false\);/, "const [isLessonSelectorOpen, setIsLessonSelectorOpen] = useState(false);" + stateVars);

// 2. Modify the display text for "Vocabulary source" to show grammar
const displayTextLogicDesktop = `
                          {selectedSetId === 'grammar' && selectedGrammarTopic ? (language === 'pl' ? \`Gramatyka \${selectedGrammarTopic.chapterIndex + 1} - \${selectedGrammarTopic.name}\` : \`Grammar \${selectedGrammarTopic.chapterIndex + 1} - \${selectedGrammarTopic.name}\`) :
                           selectedSetId === 'all' && selectedLessonIds.length === 0 ? (language === 'pl' ? 'Wybrano: Wszystkie słówka (Mix)' : 'Selected: All vocab') : 
`;
code = code.replace(/\{selectedSetId === 'all' && selectedLessonIds\.length === 0 \? \(language === 'pl' \? 'Wybrano: Wszystkie słówka \(Mix\)' : 'Selected: All vocab'\) : /g, displayTextLogicDesktop);

// 3. Inject Grammar selector in the modal
const grammarHtml = `
                                  {/* Grammar Options */}
                                  <div className="h-px w-full bg-white/10 my-4"></div>
                                  <h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Gramatyka' : 'Grammar'}</h4>
                                  {grammarChapters.length > 0 && grammarChapters.map((chapter: any, cIdx: number) => (
                                    <div key={chapter.id || cIdx} className="mb-2">
                                      <div 
                                        className="flex items-center justify-between p-4 rounded-2xl bg-[#18212e] border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => setExpandedGrammarLevel(expandedGrammarLevel === cIdx ? null : cIdx)}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                                            {cIdx + 1}
                                          </div>
                                          <span className="text-base font-semibold text-gray-300">{chapter.name}</span>
                                        </div>
                                        <ChevronDown className={\`w-5 h-5 text-gray-400 transition-transform duration-300 \${expandedGrammarLevel === cIdx ? 'rotate-180' : ''}\`} />
                                      </div>
                                      <AnimatePresence>
                                        {expandedGrammarLevel === cIdx && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="pt-2 pl-4 space-y-2">
                                              {chapter.topics.map((topic: any, tIdx: number) => {
                                                const hasSentences = (topic.sentences || "").trim().length > 0;
                                                const isSelected = selectedSetId === 'grammar' && selectedGrammarTopic?.id === topic.id;
                                                return (
                                                  <label 
                                                    key={topic.id || tIdx} 
                                                    className={\`flex items-center gap-3 p-3 rounded-xl border transition-all \${hasSentences ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} \${
                                                      isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-black/20 border-white/5 hover:border-white/10'
                                                    }\`}
                                                  >
                                                    <input 
                                                      type="radio" 
                                                      name="mobileSourceModal"
                                                      disabled={!hasSentences}
                                                      checked={isSelected}
                                                      onChange={() => {
                                                        if (hasSentences) {
                                                          setSelectedSetId('grammar');
                                                          setSelectedGrammarTopic({ ...topic, chapterIndex: cIdx });
                                                          setSelectedLessonIds([]);
                                                        }
                                                      }}
                                                      className="w-4 h-4 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                                    />
                                                    <div className="flex flex-col">
                                                      <span className={\`text-sm font-semibold \${isSelected ? 'text-emerald-400' : 'text-gray-300'}\`}>
                                                        {tIdx + 1}. {topic.name}
                                                      </span>
                                                    </div>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  ))}
`;

code = code.replace(/<div className="h-px w-full bg-white\/10 my-4"><\/div>/, grammarHtml + '\n<div className="h-px w-full bg-white/10 my-4"></div>\n<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === \'pl\' ? \'Inne\' : \'Other\'}</h4>');

// 4. Update the handleGenerate function to include grammar sentences in the prompt
const promptLogic = `
      let vocabText = "";
      if (selectedSetId === 'grammar' && selectedGrammarTopic) {
        vocabText = \`[TŁUMACZENIA]: Wygeneruj ćwiczenia, bazując ściśle na tych zdaniach, lekko je modyfikując: \\n\${selectedGrammarTopic.sentences}\`;
      } else if (selectedSetId === 'all') {
`;
code = code.replace(/let vocabText = "";\s*if \(selectedSetId === 'all'\) \{/, promptLogic);


fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
