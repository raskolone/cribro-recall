const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetLabel = `                                    return (
                                      <label 
                                        key={set.id} 
                                        className={\`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer \${
                                          isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                        }\`}
                                      >`;

const replacementLabel = `                                    const isNewAndPulsing = index === 0 && user?.hasNewVocabulary && !isBannerDismissed;
                                    return (
                                      <label 
                                        key={set.id} 
                                        className={\`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer \${
                                          isNewAndPulsing ? 'border-primary shadow-[0_0_20px_rgba(114,240,180,0.5)] animate-pulse bg-primary/20' :
                                          isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                        }\`}
                                      >`;

code = code.replace(targetLabel, replacementLabel);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
