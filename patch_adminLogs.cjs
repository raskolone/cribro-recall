const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const target = `                            <td className="p-3 capitalize">{log.exerciseType}</td>
                            <td className="p-3 line-clamp-1">{/* No setName in practice log */}</td>`;

const replacement = `                            <td className="p-3 capitalize">
                               <div className="flex items-center gap-2">
                                  {log.exerciseType}
                                  {log.exerciseFormat && (
                                     <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded border border-emerald-500/20">{log.exerciseFormat}</span>
                                  )}
                               </div>
                            </td>
                            <td className="p-3">{log.setDisplayName || '-'}</td>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/admin/AdminPanel.tsx', code);
