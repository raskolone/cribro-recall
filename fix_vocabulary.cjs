const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Remove "Cribro Recall"
code = code.replace(
  /<p className="text-\[10px\] font-bold text-gray-500 uppercase tracking-widest mb-2">\{language === 'pl' \? 'Cribro Recall' : 'Cribro Recall'\}<\/p>\n\s*/g,
  ""
);

// 2. Extract Modal Lesson Selection for Mobile
const modalRegex = /\{\/\* Modal Lesson Selection for Mobile \*\/\}[\s\S]*?<\/AnimatePresence>/;
const modalMatch = code.match(modalRegex);
if (modalMatch) {
  const modalCode = modalMatch[0];
  code = code.replace(modalRegex, "");
  
  // Insert modalCode before `</>\n                ) : (\n                  /* Other Exercises Tab`
  code = code.replace(
    /\n\s*<\/>\n\s*\) : \(\n\s*\/\* Other Exercises Tab/,
    `\n                  ${modalCode}\n                  </>\n                ) : (\n                  /* Other Exercises Tab`
  );
}

// 3. Replace mobile Section 2
const unifiedBox = `{/* Unified Źródło Słownictwa Box */}
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
                          {selectedSetId === 'all' && selectedLessonIds.length === 0 ? (language === 'pl' ? 'Wybrano: Wszystkie słówka (Mix)' : 'Selected: All vocab') : 
                           selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? (language === 'pl' ? \`Wybrane lekcje: \${vocabularySets.filter(s => selectedLessonIds.includes(s.id)).map(s => s.topic.replace(/^\\d+\\.\\s*/, '').replace(/\\(Lekcja\\s*\\d+\\)\\s*/gi, '').trim()).join(', ')}\` : \`Selected lessons: \${selectedLessonIds.length}\`) : 
                           specialTasks.find(t => 'special-task-' + t.id === selectedSetId) ? (language === 'pl' ? 'Wybrano: Zadanie specjalne' : 'Selected: Special Task') : ''}
                        </div>
                      </div>`;

// Mobile section 2
code = code.replace(
  /\{\/\* Section 2: ŹRÓDŁO SŁOWNICTWA \*\/\}[\s\S]*?(?=\{\/\* Section 3: ILOŚĆ ZDAŃ \*\/)/,
  unifiedBox + "\n\n                      "
);

// 4. Replace desktop SECTION 1 and the whole Expandable Lesson Drawer
code = code.replace(
  /\{\/\* SECTION 1: ŹRÓDŁO SŁOWNICTWA \*\/\}[\s\S]*?(?=\{\/\* SECTION 2: TRYB ĆWICZENIA \*\/)/,
  unifiedBox + "\n\n                    "
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
