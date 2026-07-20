import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes("interface AIExerciseGeneratorScreenProps")) {
  content = content.replace(
    /const AIExerciseGeneratorScreen: React\.FC<AIExerciseGeneratorScreenProps> = \(\{/,
    "interface AIExerciseGeneratorScreenProps {\n  initialSetId?: string | null;\n  onStartPractice?: (type: any, mode1?: boolean, mode2?: boolean) => void;\n  onExerciseStateChange?: (active: boolean) => void;\n}\n\nconst AIExerciseGeneratorScreen: React.FC<AIExerciseGeneratorScreenProps> = ({"
  );
  fs.writeFileSync(file, content);
  console.log("Added AIExerciseGeneratorScreenProps");
}
