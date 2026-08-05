const fs = require('fs');
let code = fs.readFileSync('components/dashboard/StudentStatsScreen.tsx', 'utf8');

const target = `                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">
                            {log.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                             log.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                             log.exerciseType === 'test' ? (language === 'pl' ? 'Test wiedzy' : 'Knowledge Test') :
                             log.exerciseType}
                          </h3>
                          {log.testName && (
                             <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono font-bold text-purple-400">
                               {log.testName}
                             </span>
                          )}
                          {log.isRevisionMode && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase font-bold tracking-wider text-amber-500">
                              {language === 'pl' ? 'Powtórka' : 'Revision'}
                            </span>
                          )}
                        </div>`;

const replacement = `                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white text-base">
                            {log.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                             log.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                             log.exerciseType === 'test' ? (language === 'pl' ? 'Test wiedzy' : 'Knowledge Test') :
                             log.exerciseType}
                          </h3>
                          {log.exerciseFormat && (
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-emerald-400">
                              {log.exerciseFormat === 'puzzle' ? (language === 'pl' ? 'Układanka' : 'Puzzle') : 
                               log.exerciseFormat === 'typing' ? (language === 'pl' ? 'Wpisywanie' : 'Typing') : 
                               log.exerciseFormat}
                            </span>
                          )}
                          {log.testName && (
                             <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono font-bold text-purple-400">
                               {log.testName}
                             </span>
                          )}
                          {log.isRevisionMode && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase font-bold tracking-wider text-amber-500">
                              {language === 'pl' ? 'Powtórka' : 'Revision'}
                            </span>
                          )}
                        </div>`;

code = code.replace(target, replacement);

const target2 = `                        <p className="text-xs text-content-muted mt-1 font-mono flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formattedDate}
                        </p>`;

const replacement2 = `                        <p className="text-xs text-content-muted mt-1 font-mono flex items-center gap-1.5 flex-wrap">
                          <Calendar className="w-3.5 h-3.5" />
                          {formattedDate}
                          {log.setDisplayName && (
                             <>
                               <span className="opacity-50 text-[10px]">•</span>
                               <span className="text-teal-300/80">{log.setDisplayName}</span>
                             </>
                          )}
                        </p>`;

code = code.replace(target2, replacement2);

fs.writeFileSync('components/dashboard/StudentStatsScreen.tsx', code);
