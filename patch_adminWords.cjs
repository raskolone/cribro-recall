const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const target = `                            <td className="p-3">{log.setDisplayName || '-'}</td>`;

const replacement = `                            <td className="p-3">
                              <div className="flex flex-col">
                                <span>{log.setDisplayName || '-'}</span>
                                {log.wordsUsed && log.wordsUsed.length > 0 && (
                                  <span className="text-[10px] text-content-muted mt-0.5 line-clamp-1" title={log.wordsUsed.join(', ')}>
                                    {log.wordsUsed.join(', ')}
                                  </span>
                                )}
                              </div>
                            </td>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/admin/AdminPanel.tsx', code);
