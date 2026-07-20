const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLoaderSignature = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {`;
const newLoaderSignature = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string }> = ({ language, level, logs }) => {`;

const oldLoaderEnd = `      <p className="text-content-muted">
        {language === 'pl' ? 'Budowanie idealnych zdań dla Ciebie...' : 'Building perfect sentences for you...'}
      </p>
    </div>
  );
};`;
const newLoaderEnd = `      <p className="text-content-muted mb-8">
        {language === 'pl' ? 'Budowanie idealnych zdań dla Ciebie...' : 'Building perfect sentences for you...'}
      </p>
      
      {/* Aesthetic terminal-like log viewer during generation */}
      {logs && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-left shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
            </div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 ml-2">System Processing</span>
          </div>
          <div className="text-xs font-mono text-primary/70 whitespace-pre-wrap max-h-[120px] overflow-y-auto custom-scrollbar flex flex-col-reverse">
             {logs}
          </div>
        </motion.div>
      )}
    </div>
  );
};`;

if (content.includes(oldLoaderSignature) && content.includes(oldLoaderEnd)) {
  content = content.replace(oldLoaderSignature, newLoaderSignature);
  content = content.replace(oldLoaderEnd, newLoaderEnd);
  fs.writeFileSync(path, content);
  console.log("Patched loader successfully");
} else {
  console.log("oldLoader not found");
}
