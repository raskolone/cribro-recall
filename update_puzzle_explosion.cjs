const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const regex = /\{step === 'puzzle-success' && \([\s\S]*?\{step === 'results' && evaluationResults\.length > 0 && \(/;

const newAnimation = `{step === 'puzzle-success' && (
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-fade-in-up">
          <div className="relative w-48 h-48 flex items-center justify-center mb-6">
            {/* Explosion of puzzle pieces */}
            {Array.from({ length: 16 }).map((_, i) => (
              <motion.div
                key={'particle-'+i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ 
                  x: Math.cos((i * 22.5) * Math.PI / 180) * (120 + Math.random() * 80), 
                  y: Math.sin((i * 22.5) * Math.PI / 180) * (120 + Math.random() * 80),
                  scale: Math.random() * 1 + 0.5,
                  opacity: 0,
                  rotate: Math.random() * 720 - 360
                }}
                transition={{ duration: 1.5 + Math.random() * 0.5, ease: "easeOut" }}
                className={\`absolute w-8 h-8 rounded-md mix-blend-screen \${['bg-emerald-400', 'bg-teal-400', 'bg-cyan-400', 'bg-green-300'][i % 4]}\`}
                style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)' }}
              />
            ))}

            {/* Impact wave */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border-4 border-emerald-400/60"
            />

            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6, duration: 1 }}
              className="w-28 h-28 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-3xl flex items-center justify-center relative z-10 shadow-[0_0_60px_rgba(52,211,153,0.8)] backdrop-blur-xl border border-white/30"
            >
              <Puzzle className="w-14 h-14 text-black/90 drop-shadow-lg" />
            </motion.div>
          </div>
          
          <div className="text-center space-y-3 mb-4">
            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-md">
              {language === 'pl' ? 'Świetna robota!' : 'Great job!'}
            </h2>
            <p className="text-xl text-emerald-300 font-medium drop-shadow">
              {language === 'pl' 
                 ? 'Teraz czas na samodzielne tłumaczenie.' 
                 : 'Now it\\'s time for independent translation.'}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 w-full max-w-sm mt-4">
            <AILoadingButton 
              onClick={handleProceedToTrueChallenge} 
              isLoading={isLoading}
              loadingText={language === 'pl' ? 'Przygotowywanie...' : 'Preparing...'}
              className="relative w-full py-5 text-xl font-black text-white rounded-2xl overflow-hidden group border border-emerald-300/40 bg-gradient-to-b from-emerald-500/50 to-emerald-700/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(52,211,153,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(52,211,153,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] skew-x-[-30deg] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
              <span className="relative z-10 drop-shadow-md">
                {language === 'pl' ? 'Podejmij Wyzwanie 🔥' : 'Take the Challenge 🔥'}
              </span>
            </AILoadingButton>
            
            <button 
              onClick={handleMaybeLater} 
              className="text-sm font-medium text-content-muted hover:text-white transition-colors py-2 px-4"
            >
              {language === 'pl' ? 'Może później' : 'Maybe later'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS EVALUATION */}
      {step === 'results' && evaluationResults.length > 0 && (`

code = code.replace(regex, newAnimation);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
