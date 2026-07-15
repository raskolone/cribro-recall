import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add playTickSound after imports
audio_script = """import { ExerciseType } from '../../types';

let audioCtx: AudioContext | null = null;
const playTickSound = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    // Ignore audio errors
  }
};
"""
content = content.replace("import { ExerciseType } from '../../types';", audio_script)

# 2. Change bg-base-300/50 p-1.5 rounded-xl border border-primary/10
# to bg-black/30 p-1.5 rounded-xl border border-white/5
content = content.replace('bg-base-300/50 p-1.5 rounded-xl border border-primary/10', 'bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner')

# 3. Change numSentences input
# max="50" -> max="20"
# onChange={(e) => setNumSentences(parseInt(e.target.value))} -> onChange={(e) => { setNumSentences(parseInt(e.target.value)); playTickSound(); }}
# <span>50</span> -> <span>20</span>
# Only for numSentences range input
num_sentences_html = """                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={numSentences}
                        onChange={(e) => setNumSentences(parseInt(e.target.value))}
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1</span>
                        <span>50</span>
                      </div>"""

new_num_sentences_html = """                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={numSentences}
                        onChange={(e) => {
                          setNumSentences(parseInt(e.target.value));
                          playTickSound();
                        }}
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1</span>
                        <span>20</span>
                      </div>"""
content = content.replace(num_sentences_html, new_num_sentences_html)


# 4. Change timeLimit input
# max="15" -> max="20"
# onChange={(e) => setTimeLimit(parseInt(e.target.value))} -> onChange={(e) => { setTimeLimit(parseInt(e.target.value)); playTickSound(); }}
# <span>15 min</span> -> <span>20 min</span>
time_limit_html = """                      <input
                        type="range"
                        min="1"
                        max="15"
                        step="1"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1 min</span>
                        <span>15 min</span>
                      </div>"""

new_time_limit_html = """                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={timeLimit}
                        onChange={(e) => {
                          setTimeLimit(parseInt(e.target.value));
                          playTickSound();
                        }}
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1 min</span>
                        <span>20 min</span>
                      </div>"""
content = content.replace(time_limit_html, new_time_limit_html)

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
