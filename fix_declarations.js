import fs from 'fs';
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const doubleDecs = `    try {
      let wordsToUse: string[] = [];
      let lessonContextString = '';
      let pastExercisesContext = "";

      // Parallelize Firebase fetches to significantly speed up generation
      let wordsToUse: string[] = [];
      let lessonContextString = '';
      let pastExercisesContext = "";
      let weaknessesListStr = "Brak zidentyfikowanych błędów";`;

const fixedDecs = `    try {
      // Parallelize Firebase fetches to significantly speed up generation
      let wordsToUse: string[] = [];
      let lessonContextString = '';
      let pastExercisesContext = "";
      let weaknessesListStr = "Brak zidentyfikowanych błędów";`;

content = content.replace(doubleDecs, fixedDecs);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
