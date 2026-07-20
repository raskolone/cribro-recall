const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldRender = `      {debugLogs && <div className="text-xs font-mono text-white/50 whitespace-pre-wrap mb-4 bg-black/40 p-4 rounded-xl">{debugLogs}</div>}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}`;

const newRender = `      {/* Enhanced Error & Loading Logs */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-6 bg-gradient-to-r from-red-500/20 to-red-900/20 border border-red-500/30 backdrop-blur-md text-red-100 p-4 rounded-2xl shadow-[0_8px_30px_rgba(239,68,68,0.15)] flex flex-col gap-3 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 mt-1">
                <h4 className="font-bold text-red-300 text-sm mb-1">{language === 'pl' ? 'Ups, coś poszło nie tak' : 'Oops, something went wrong'}</h4>
                <div className="text-sm text-red-200/90 leading-relaxed">{error}</div>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-red-400/70" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>`;

if (content.includes(oldRender)) {
  content = content.replace(oldRender, newRender);
  fs.writeFileSync(path, content);
  console.log("Patched render successfully");
} else {
  console.log("oldRender not found");
}
