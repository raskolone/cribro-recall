const fs = require('fs');
let code = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

const target = `               <div 
                 key={log.id} 
                 onClick={() => setSelectedLog(log)}
                 className="liquid-glass-tile p-4 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer hover:border-primary/50 hover:liquid-glass-tile/80 transition-colors group"
               >
                 <div className="flex flex-col gap-1">`;

const replacement = `               <div 
                 key={log.id} 
                 onClick={() => setSelectedLog(log)}
                 className="liquid-glass-tile p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:border-primary/50 hover:liquid-glass-tile/80 transition-colors group gap-4"
               >
                 <div className="flex flex-col gap-2">`;

code = code.replace(target, replacement);

const target2 = `                   <div className="text-xs text-content-muted font-mono flex items-center gap-1.5 flex-wrap">
                     <Calendar className="w-3 h-3" />
                     {new Date(log.date).toLocaleString()}
                     {log.setDisplayName && (
                       <>
                         <span className="opacity-50 text-[10px]">•</span>
                         <BookOpen className="w-3 h-3" />
                         <span className="text-teal-300/80">{log.setDisplayName}</span>
                       </>
                     )}
                   </div>
                 </div>
                 
                 <div className="flex gap-4 text-sm font-mono text-right">`;

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
                   </div>
                   {log.wordsUsed && log.wordsUsed.length > 0 && (
                     <div className="text-xs text-content-muted mt-1 max-w-xl">
                       <strong>{language === 'pl' ? 'Wykorzystane słownictwo:' : 'Vocabulary used:'}</strong> {log.wordsUsed.join(', ')}
                     </div>
                   )}
                 </div>
                 
                 <div className="flex gap-4 text-sm font-mono text-right shrink-0">`;

code = code.replace(target2, replacement2);
fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', code);
