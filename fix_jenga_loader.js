import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

const oldLoader = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
      <h3 className="text-2xl font-display font-bold text-white mb-2">
        {language === 'pl' ? 'Generowanie ćwiczenia...' : 'Generating exercise...'}
      </h3>
      <p className="text-content-muted">
        {language === 'pl' ? 'AI analizuje Twój profil i przygotowuje zadania' : 'AI is analyzing your profile and preparing tasks'}
      </p>
    </div>
  );
};`;

const newLoader = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
      <div className="relative w-16 h-24 mb-8 flex flex-col justify-end gap-1">
        {[4, 3, 2, 1, 0].map((i) => (
          <motion.div
            key={i}
            className={\`h-3 rounded-sm \${i % 2 === 0 ? 'bg-primary' : 'bg-primary/60'}\`}
            initial={{ opacity: 0, y: -50, rotate: i % 2 === 0 ? 0 : 90, scaleX: i % 2 === 0 ? 1 : 0.3, scaleY: i % 2 === 0 ? 1 : 3.3 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-50, 0, 0, 50] }}
            transition={{
              duration: 2,
              times: [0, 0.2, 0.8, 1],
              delay: (4 - i) * 0.15,
              repeat: Infinity,
              repeatDelay: 0.5,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
      <h3 className="text-2xl font-display font-bold text-white mb-2">
        {language === 'pl' ? 'Generowanie ćwiczenia...' : 'Generating exercise...'}
      </h3>
      <p className="text-content-muted">
        {language === 'pl' ? 'Budowanie idealnych zdań dla Ciebie...' : 'Building perfect sentences for you...'}
      </p>
    </div>
  );
};`;

content = content.replace(oldLoader, newLoader);

fs.writeFileSync(file, content);
console.log("Jenga loader restored!");
