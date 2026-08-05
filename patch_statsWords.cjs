const fs = require('fs');
let code = fs.readFileSync('components/dashboard/StudentStatsScreen.tsx', 'utf8');

const target = `                        <p className="text-xs text-content-muted mt-1 font-mono flex items-center gap-1.5 flex-wrap">
                          <Calendar className="w-3.5 h-3.5" />
                          {formattedDate}
                          {log.setDisplayName && (
                             <>
                               <span className="opacity-50 text-[10px]">•</span>
                               <span className="text-teal-300/80">{log.setDisplayName}</span>
                             </>
                          )}
                        </p>
                      </div>`;

const replacement = `                        <p className="text-xs text-content-muted mt-1 font-mono flex items-center gap-1.5 flex-wrap">
                          <Calendar className="w-3.5 h-3.5" />
                          {formattedDate}
                          {log.setDisplayName && (
                             <>
                               <span className="opacity-50 text-[10px]">•</span>
                               <span className="text-teal-300/80">{log.setDisplayName}</span>
                             </>
                          )}
                        </p>
                        {log.wordsUsed && log.wordsUsed.length > 0 && (
                          <div className="text-xs text-content-muted mt-1">
                            <strong>{language === 'pl' ? 'Wykorzystane słownictwo:' : 'Vocabulary used:'}</strong> {log.wordsUsed.join(', ')}
                          </div>
                        )}
                      </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/StudentStatsScreen.tsx', code);
