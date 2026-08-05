const fs = require('fs');
let code = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

const target = `                     <span className="font-bold text-white text-base group-hover:text-primary transition-colors">
                       {log.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                        log.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                        log.exerciseType}
                     </span>`;

const replacement = `                     <span className="font-bold text-white text-base group-hover:text-primary transition-colors flex items-center gap-2">
                       {log.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                        log.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                        log.exerciseType}
                       {log.exerciseFormat && (
                         <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono font-medium text-emerald-400">
                           {log.exerciseFormat === 'puzzle' ? (language === 'pl' ? 'Układanka' : 'Puzzle') : 
                            log.exerciseFormat === 'typing' ? (language === 'pl' ? 'Wpisywanie' : 'Typing') : 
                            log.exerciseFormat}
                         </span>
                       )}
                     </span>`;

code = code.replace(target, replacement);

const target2 = `                   <div className="text-xs text-content-muted font-mono flex items-center gap-1.5">
                     <Calendar className="w-3 h-3" />
                     {new Date(log.date).toLocaleString()}
                   </div>`;

const replacement2 = `                   <div className="text-xs text-content-muted font-mono flex items-center gap-1.5 flex-wrap">
                     <Calendar className="w-3 h-3" />
                     {new Date(log.date).toLocaleString()}
                     {log.setDisplayName && (
                       <>
                         <span className="opacity-50 text-[10px]">•</span>
                         <BookOpen className="w-3 h-3" />
                         <span className="text-teal-300/80">{log.setDisplayName}</span>
                       </>
                     )}
                   </div>`;

code = code.replace(target2, replacement2);

fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', code);
