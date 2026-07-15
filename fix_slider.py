import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

start_marker = "{practiceMode === 'time' && ("
end_marker = "              </Card>"

start_idx = code.find(start_marker)
end_idx = code.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    exit(1)

new_time_ui = """{practiceMode === 'time' && (
                  <div className="mb-6 relative">
                    <label className="flex items-center justify-between text-sm font-bold text-content-muted uppercase tracking-wider mb-8">
                      <span>{language === 'pl' ? 'Czas na rozwiązanie (minuty)' : 'Time to solve (minutes)'}</span>
                      <div className="absolute right-0 -top-2 bg-primary text-black font-black text-xl px-4 py-1.5 rounded-xl shadow-[0_0_20px_rgba(114,240,180,0.4)] animate-pulse-slow">
                        <span ref={timeLimitRef}>{timeLimit}</span>
                      </div>
                    </label>
                    <div className="relative pt-4 pb-2 px-2">
                      <input
                        type="range"
                        min="1"
                        max="15"
                        step="1"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1 min</span>
                        <span>15 min</span>
                      </div>
                    </div>
                  </div>
                )}
"""

code = code[:start_idx] + new_time_ui + code[end_idx:]

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated time slider successfully!")
