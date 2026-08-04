const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const regex = /\{step === 'puzzle-success' && \([\s\S]*?<div className="relative">[\s\S]*?<Award className="w-16 h-16 text-primary" \/>[\s\S]*?<\/motion\.div>[\s\S]*?<\/div>/;

const newAnimation = `
{step === 'puzzle-success' && (
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-fade-in-up">
          <div className="relative w-48 h-48 flex items-center justify-center mb-4">
            {/* Multi-layered rotating geometric puzzle aura */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 border-[3px] border-emerald-400/30 rounded-2xl"
                initial={{ rotate: 0, scale: 0.8, borderRadius: '25%' }}
                animate={{ 
                  rotate: 360, 
                  scale: [0.8, 1.1, 1],
                  borderRadius: ['25%', '50%', '25%']
                }}
                transition={{
                  rotate: { repeat: Infinity, duration: 10 + i * 3, ease: "linear" },
                  scale: { duration: 1.5, delay: i * 0.2, ease: "backOut" },
                  borderRadius: { repeat: Infinity, duration: 5 + i, ease: "easeInOut", repeatType: "reverse" }
                }}
              />
            ))}
            
            {/* 4 Puzzle pieces sliding into place */}
            {[
              { x: -50, y: -50, color: 'bg-emerald-400' },
              { x: 50, y: -50, color: 'bg-teal-400' },
              { x: -50, y: 50, color: 'bg-cyan-400' },
              { x: 50, y: 50, color: 'bg-emerald-500' }
            ].map((piece, idx) => (
              <motion.div
                key={'piece-'+idx}
                initial={{ x: piece.x, y: piece.y, opacity: 0, scale: 0.5, rotate: piece.x > 0 ? 45 : -45 }}
                animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, type: "spring", bounce: 0.5 }}
                className={\`absolute w-12 h-12 \${piece.color} rounded-lg opacity-80 mix-blend-screen\`}
                style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)' }}
              />
            ))}

            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6, duration: 1, delay: 0.8 }}
              className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center relative z-10 shadow-[0_0_40px_rgba(52,211,153,0.6)] backdrop-blur-xl border border-white/20"
            >
              <Puzzle className="w-12 h-12 text-black/80 drop-shadow-md" />
            </motion.div>
            
            <motion.div 
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="absolute inset-0 bg-emerald-400/40 rounded-full blur-2xl z-0"
            />
          </div>
`;

code = code.replace(regex, newAnimation);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
