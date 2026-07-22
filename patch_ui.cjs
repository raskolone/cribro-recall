const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const specialTaskRender = `
                        {/* Zadania specjalne */}
                        {specialTasks.length > 0 && specialTasks.map(task => (
                          <div key={task.id} className={\`border-2 rounded-2xl overflow-hidden liquid-glass-tile transition-all duration-300 \${
                            selectedSetId === 'special-task-' + task.id
                              ? 'border-primary/50 bg-primary/[0.08] shadow-[0_8px_30px_rgba(114,240,180,0.2)]'
                              : 'border-primary/20 bg-base-200/40 hover:bg-base-200/60 hover:border-primary/30'
                          }\`}>
                            <button
                              className="w-full flex items-center justify-between p-5 transition-colors"
                              onClick={() => {
                                if (selectedSetId !== 'special-task-' + task.id) {
                                  setSelectedSetId('special-task-' + task.id);
                                  setSelectedLessonIds([]);
                                } else {
                                  setSelectedSetId('');
                                }
                              }}
                            >
                              <div className="flex items-center gap-4">
                                <div className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all \${
                                  selectedSetId === 'special-task-' + task.id
                                    ? 'border-primary bg-primary text-black'
                                    : 'border-primary/50'
                                }\`}>
                                  {selectedSetId === 'special-task-' + task.id && <div className="w-2 h-2 bg-black rounded-full" />}
                                </div>
                                <div className="p-2.5 bg-primary/20 rounded-xl shrink-0 animate-pulse shadow-[0_0_15px_rgba(114,240,180,0.3)]">
                                  <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                                <div className="text-left">
                                  <span className="font-bold text-lg text-white block">
                                    {language === 'pl' ? 'Zadanie specjalne' : 'Special Task'}
                                  </span>
                                  <span className="text-xs text-primary font-mono block">Od Nauczyciela • {task.sentences?.length} zdań</span>
                                </div>
                              </div>
                            </button>
                          </div>
                        ))}

                        {/* Opcja 1: Lekcje (Prominent) */}
`;

code = code.replace(
  /\{?\/\*\s*Opcja 1: Lekcje \(Prominent\)\s*\*\/\}/g,
  specialTaskRender.trim()
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('patched ui');
