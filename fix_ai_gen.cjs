const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Add onOpenSidebar to interface
code = code.replace(
  /interface AIExerciseGeneratorScreenProps \{/,
  'interface AIExerciseGeneratorScreenProps {\n  onOpenSidebar?: () => void;'
);

// 2. Add to props
code = code.replace(
  /const AIExerciseGeneratorScreen: React\.FC<AIExerciseGeneratorScreenProps> = \(\{ initialSetId = null, onStartPractice, onExerciseStateChange \}\) => \{/,
  'const AIExerciseGeneratorScreen: React.FC<AIExerciseGeneratorScreenProps> = ({ initialSetId = null, onStartPractice, onExerciseStateChange, onOpenSidebar }) => {'
);

// 3. Hide desktop header on mobile
code = code.replace(
  /className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5"/,
  'className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5"'
);

// 4. Modify mobile redesign header
code = code.replace(
  /<div className="pt-8 pb-6 px-6 text-center">\s*<h2 className="text-2xl font-bold text-white mb-1">\{language === 'pl' \? 'Konfiguracja Treningu' : 'Training Configuration'\}<\/h2>\s*<p className="text-sm text-gray-400">\{language === 'pl' \? 'Dostosuj i rozpocznij sesję AI.' : 'Customize and start AI session.'\}<\/p>\s*<\/div>/,
  `<div className="pt-6 pb-6 px-6 flex items-center justify-between">
                      <button 
                        onClick={onOpenSidebar}
                        className="p-2 -ml-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                      <h2 className="text-2xl font-bold text-white">{language === 'pl' ? 'Czas na trening' : 'Time for training'}</h2>
                      <div className="w-10"></div>
                    </div>`
);

// 5. Modify slider buttons to actual slider (1 to 25)
// The section starts with <div className="flex justify-between gap-3"> and ends after the map for [5, 10, 15, 20]
code = code.replace(
  /<div className="flex justify-between gap-3">\s*\{\[5, 10, 15, 20\]\.map\(\(val\) => \(\s*<button\s*key=\{val\}\s*type="button"\s*onClick=\{\(\) => \{\s*setNumSentences\(val\);\s*playSliderSound\(\);\s*\}\}\s*className=\{`flex-1 py-3 rounded-full font-bold text-sm transition-all duration-300 \$\{\s*numSentences === val\s*\? 'bg-\[#10b981\] text-black shadow-\[0_0_20px_rgba\(16,185,129,0\.4\)\] scale-105'\s*: 'bg-\[#131b26\] border border-white\/10 text-gray-400 hover:text-white'\s*\}\`\}\s*>\s*\{val\}\s*<\/button>\s*\)\}\s*<\/div>/,
  `<div className="bg-[#121824] border border-primary/20 rounded-2xl p-5 space-y-4 animate-pulsar-soft">
                          <input
                            type="range"
                            min="1"
                            max="25"
                            step="1"
                            value={numSentences}
                            onChange={(e) => {
                              setNumSentences(parseInt(e.target.value));
                              playSliderSound();
                            }}
                            className="w-full h-2 bg-[#202b3c] rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                          />
                        </div>`
);

// Also let's find the desktop slider and change max to 25 just for consistency
code = code.replace(
  /<input\s*type="range"\s*min="1"\s*max="20"/,
  '<input\n                          type="range"\n                          min="1"\n                          max="25"'
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
