const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const specialTasksBlock = `                                  {specialTasks.length > 0 && specialTasks.map(task => (
                                    <label key={task.id} className={\`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer \${
                                      selectedSetId === 'special-task-' + task.id ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                    }\`}>
                                      <input 
                                        type="radio" 
                                        name="mobileSourceModal"
                                        checked={selectedSetId === 'special-task-' + task.id}
                                        onChange={() => {
                                          if (selectedSetId !== 'special-task-' + task.id) {
                                            setSelectedSetId('special-task-' + task.id);
                                            setSelectedLessonIds([]);
                                          } else {
                                            setSelectedSetId('all');
                                          }
                                        }}
                                        className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                      />
                                      <span className={\`text-base font-semibold \${selectedSetId === 'special-task-' + task.id ? 'text-emerald-400' : 'text-gray-300'}\`}>
                                        {task.title}
                                      </span>
                                    </label>
                                  ))}
`;

code = code.replace(
  /<div className="h-px w-full bg-white\/10 my-4"><\/div>/,
  `\n                                  <div className="h-px w-full bg-white/10 my-4"></div>\n${specialTasksBlock}`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
