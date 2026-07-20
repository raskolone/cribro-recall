import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

const regex = /(const AIGenerationLoader: React\.FC[^]*?)(?=const AIExerciseGeneratorScreen: React\.FC)/s;
const replacement = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {
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
};

`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log("Fixed AIGenerationLoader");
