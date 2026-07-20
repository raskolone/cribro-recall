const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSection = \`                      <div className="space-y-2.5">
                        {/* Opcja 1: Lekcje */}
                        <div className={\\\`border rounded-xl overflow-hidden transition-all duration-300 \${
                          selectedSetId === 'lessons' || selectedLessonIds.length > 0 
                             ? 'border-primary/30 bg-primary/[0.03] shadow-[0_4px_20px_rgba(114,240,180,0.05)]' 
                             : 'border-white/5 bg-base-200/20 hover:bg-base-200/40 hover:border-white/10'
                        }\\\`}>
                          <button 
                             className="w-full flex items-center justify-between p-3.5 transition-colors"
                            onClick={() => {
                              if (selectedSetId !== 'lessons') {
                                setSelectedSetId('lessons');
                                if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                                  setSelectedLessonIds([vocabularySets[0].id]);
                                }
                              } else {
                                setSelectedSetId('');
                                setSelectedLessonIds([]);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className={\\\`w-4 h-4 rounded-full border flex items-center justify-center transition-all \${
                                (selectedSetId === 'lessons' || selectedLessonIds.length > 0) 
                                   ? 'border-primary bg-primary text-black' 
                                   : 'border-white/30'
                              }\\\`}>
                                {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                              </div>
                              <BookOpen className="w-4 h-4 text-primary shrink-0" />
                              <span className="font-semibold text-sm text-white/95">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</span>
                            </div>
                            <ChevronDown className={\\\`w-4 h-4 text-content-muted transition-transform duration-300 \${
                              (selectedSetId === 'lessons' || selectedLessonIds.length > 0) ? 'rotate-180 text-primary' : ''
                            }\\\`} />
                          </button>\`;

const newSection = \`                      <div className="space-y-4">
                        {/* Opcja 1: Lekcje (Prominent) */}
                        <div className={\\\`border-2 rounded-2xl overflow-hidden transition-all duration-300 \${
                          selectedSetId === 'lessons' || selectedLessonIds.length > 0 
                             ? 'border-primary/40 bg-primary/[0.05] shadow-[0_8px_30px_rgba(114,240,180,0.1)]' 
                             : 'border-white/10 bg-base-200/40 hover:bg-base-200/60 hover:border-primary/20'
                        }\\\`}>
                          <button 
                             className="w-full flex items-center justify-between p-5 transition-colors"
                            onClick={() => {
                              if (selectedSetId !== 'lessons') {
                                setSelectedSetId('lessons');
                                if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                                  setSelectedLessonIds([vocabularySets[0].id]);
                                }
                              } else {
                                setSelectedSetId('');
                                setSelectedLessonIds([]);
                              }
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className={\\\`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all \${
                                (selectedSetId === 'lessons' || selectedLessonIds.length > 0) 
                                   ? 'border-primary bg-primary text-black' 
                                   : 'border-white/30'
                              }\\\`}>
                                {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && <div className="w-2 h-2 bg-black rounded-full" />}
                              </div>
                              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                                <BookOpen className="w-6 h-6 text-primary" />
                              </div>
                              <span className="font-bold text-lg text-white">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</span>
                            </div>
                            <ChevronDown className={\\\`w-5 h-5 text-content-muted transition-transform duration-300 \${
                              (selectedSetId === 'lessons' || selectedLessonIds.length > 0) ? 'rotate-180 text-primary' : ''
                            }\\\`} />
                          </button>\`;

if (content.includes("Opcja 1: Lekcje")) {
  content = content.replace(oldSection, newSection);
  fs.writeFileSync(path, content);
  console.log("Patched generator UI start successfully");
} else {
  console.log("oldSection not found");
}
