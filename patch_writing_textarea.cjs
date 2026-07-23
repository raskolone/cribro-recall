const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = `</label>\n                )})}
              </div>
            </div>`;
const newStr = `</label>\n                )})}
              </div>
              {selectedTypes.includes('writing') && (
                <div className="mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <label className="block text-sm font-bold text-primary mb-2">Temat writingu i wymagania (np. limit znaków)</label>
                  <textarea
                    value={writingTopic}
                    onChange={e => setWritingTopic(e.target.value)}
                    className="w-full bg-base-100 border border-white/10 rounded-lg p-3 outline-none focus:border-primary/50 text-white min-h-[100px]"
                    placeholder="Podaj temat, instrukcje i limit znaków dla zadania otwartego..."
                  />
                  <p className="text-xs text-primary/70 mt-2">
                    Uwaga: Zadanie to będzie miało zablokowane funkcje kopiowania, wklejania oraz autokorekty w panelu kursanta.
                  </p>
                </div>
              )}
            </div>`;

content = content.replace(oldStr, newStr);
fs.writeFileSync(file, content);
