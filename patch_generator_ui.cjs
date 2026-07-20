const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldUIStart = `                      <div className="space-y-3">
                        {/* Opcja 1: Moje lekcje */}
                        <div className={\`rounded-xl border transition-all duration-300 \${
                          (selectedSetId === 'lessons' || selectedLessonIds.length > 0) 
                            ? 'bg-primary/[0.03] border-primary/30 shadow-[0_4px_20px_rgba(114,240,180,0.05)]' 
                            : 'bg-base-200/20 border-white/5 hover:bg-base-200/40 hover:border-white/10'
                        }\`}>`;

const newUIStart = `                      <div className="space-y-4">
                        {/* Opcja 1: Moje lekcje (Prominent) */}
                        <div className={\`rounded-2xl border-2 transition-all duration-300 \${
                          (selectedSetId === 'lessons' || selectedLessonIds.length > 0) 
                            ? 'bg-primary/[0.05] border-primary/40 shadow-[0_8px_30px_rgba(114,240,180,0.1)]' 
                            : 'bg-base-200/40 border-white/10 hover:bg-base-200/60 hover:border-primary/20'
                        }\`}>`;

const oldUIBtn = `                          <button 
                            className="w-full flex items-center justify-between p-3.5"
                            onClick={() => {`;

const newUIBtn = `                          <button 
                            className="w-full flex items-center justify-between p-5"
                            onClick={() => {`;

const oldUILabel = `                              <BookOpen className="w-4 h-4 text-primary shrink-0" />
                              <span className="font-semibold text-sm text-white/95">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</span>`;

const newUILabel = `                              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                <BookOpen className="w-5 h-5 text-primary" />
                              </div>
                              <span className="font-bold text-base text-white">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</span>`;

const oldOptions = `                        {/* Opcja 2: Wszystkie moje słówka */}
                        <button 
                          className={\`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 \${
                            selectedSetId === 'all' && selectedLessonIds.length === 0 
                              ? 'bg-primary/[0.03] border-primary/30 shadow-[0_4px_20px_rgba(114,240,180,0.05)]' 
                              : 'bg-base-200/20 border-white/5 hover:bg-base-200/40 hover:border-white/10'
                          }\`}
                          onClick={() => { setSelectedSetId('all'); setSelectedLessonIds([]); }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={\`w-4 h-4 rounded-full border flex items-center justify-center transition-all \${
                              (selectedSetId === 'all' && selectedLessonIds.length === 0) 
                                ? 'border-primary bg-primary text-black' 
                                : 'border-white/30'
                            }\`}>
                              {(selectedSetId === 'all' && selectedLessonIds.length === 0) && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                            </div>
                            <Layers className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-semibold text-sm text-white/95">{language === 'pl' ? 'Wszystkie moje słówka (Mix)' : 'All my vocabulary (Mix)'}</span>
                          </div>
                        </button>

                        {/* Opcja 3: Losowe zdania */}
                        <button 
                          className={\`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 \${
                            selectedSetId === 'random' && selectedLessonIds.length === 0 
                              ? 'bg-primary/[0.03] border-primary/30 shadow-[0_4px_20px_rgba(114,240,180,0.05)]' 
                              : 'bg-base-200/20 border-white/5 hover:bg-base-200/40 hover:border-white/10'
                          }\`}
                          onClick={() => { setSelectedSetId('random'); setSelectedLessonIds([]); }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={\`w-4 h-4 rounded-full border flex items-center justify-center transition-all \${
                              (selectedSetId === 'random' && selectedLessonIds.length === 0) 
                                ? 'border-primary bg-primary text-black' 
                                : 'border-white/30'
                            }\`}>
                              {(selectedSetId === 'random' && selectedLessonIds.length === 0) && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                            </div>
                            <Shuffle className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-semibold text-sm text-white/95">{language === 'pl' ? 'Losowe zdania' : 'Random sentences'}</span>
                          </div>
                        </button>`;

const newOptions = `                        <div className="flex flex-col gap-2.5 mt-2 pl-2 border-l border-white/10">
                          {/* Opcja 2: Wszystkie moje słówka */}
                          <button 
                            className={\`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 \${
                              selectedSetId === 'all' && selectedLessonIds.length === 0 
                                ? 'bg-primary/[0.03] border-primary/30 shadow-[0_2px_10px_rgba(114,240,180,0.05)]' 
                                : 'bg-base-200/10 border-transparent hover:bg-base-200/30 hover:border-white/5'
                            }\`}
                            onClick={() => { setSelectedSetId('all'); setSelectedLessonIds([]); }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={\`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all \${
                                (selectedSetId === 'all' && selectedLessonIds.length === 0) 
                                  ? 'border-primary bg-primary text-black' 
                                  : 'border-white/20'
                              }\`}>
                                {(selectedSetId === 'all' && selectedLessonIds.length === 0) && <div className="w-1 h-1 bg-black rounded-full" />}
                              </div>
                              <Layers className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                              <span className="font-medium text-xs text-white/70">{language === 'pl' ? 'Wszystkie moje słówka (Mix)' : 'All my vocabulary (Mix)'}</span>
                            </div>
                          </button>

                          {/* Opcja 3: Losowe zdania */}
                          <button 
                            className={\`w-full flex items-center justify-between p-2 rounded-lg border transition-all duration-300 \${
                              selectedSetId === 'random' && selectedLessonIds.length === 0 
                                ? 'bg-primary/[0.03] border-primary/30 shadow-[0_2px_10px_rgba(114,240,180,0.05)]' 
                                : 'bg-transparent border-transparent hover:bg-base-200/20'
                            }\`}
                            onClick={() => { setSelectedSetId('random'); setSelectedLessonIds([]); }}
                          >
                            <div className="flex items-center gap-2.5 opacity-80">
                              <div className={\`w-3 h-3 rounded-full border flex items-center justify-center transition-all \${
                                (selectedSetId === 'random' && selectedLessonIds.length === 0) 
                                  ? 'border-primary bg-primary text-black' 
                                  : 'border-white/20'
                              }\`}>
                                {(selectedSetId === 'random' && selectedLessonIds.length === 0) && <div className="w-1 h-1 bg-black rounded-full" />}
                              </div>
                              <Shuffle className="w-3 h-3 text-primary/50 shrink-0" />
                              <span className="text-[11px] text-white/50">{language === 'pl' ? 'Losowe zdania' : 'Random sentences'}</span>
                            </div>
                          </button>
                        </div>`;

if (content.includes("Opcja 1: Moje lekcje")) {
  content = content.replace(oldUIStart, newUIStart);
  content = content.replace(oldUIBtn, newUIBtn);
  content = content.replace(oldUILabel, newUILabel);
  content = content.replace(oldOptions, newOptions);
  fs.writeFileSync(path, content);
  console.log("Patched generator UI successfully");
} else {
  console.log("oldUIStart not found");
}
