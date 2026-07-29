const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetStr = `<div className="flex justify-between gap-3">
                          {[5, 10, 15, 20].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setNumSentences(val);
                                playSliderSound();
                              }}
                              className={\`flex-1 py-3 rounded-full font-bold text-sm transition-all duration-300 \${
                                numSentences === val
                                  ? 'bg-[#10b981] text-black shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105'
                                  : 'bg-[#131b26] border border-white/10 text-gray-400 hover:text-white'
                              }\`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>`;

const replacement = `<div className="bg-[#121824] border border-primary/20 rounded-2xl p-5 space-y-4 animate-pulsar-soft">
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
                        </div>`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
