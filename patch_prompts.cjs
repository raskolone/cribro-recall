const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

// Update generateTranslationExercises signature to accept mistakes
const targetSig = "pastExercisesContext?: string,";
const replacementSig = "pastExercisesContext?: string,\n  mistakesContext?: string,";
code = code.replace(targetSig, replacementSig);

const targetBlock = "const shortPast = pastExercisesContext ? `\\n\\n[PAST EXERCISES TO AVOID REPEATS]:\\n${pastExercisesContext.substring(0, 5000)}` : '';";
const replacementBlock = `const shortPast = pastExercisesContext ? \`\\n\\n[PAST EXERCISES TO AVOID REPEATS]:\\n\${pastExercisesContext.substring(0, 5000)}\` : '';
  const shortMistakes = mistakesContext ? \`\\n\\n[STUDENT MISTAKES (AREAS TO IMPROVE)]:\\n\${mistakesContext.substring(0, 5000)}\` : '';`;
code = code.replace(targetBlock, replacementBlock);

const targetContextBlock = "const studentContextBlock = `${shortProfile}${shortLesson}${shortPast}`;";
const replacementContextBlock = "const studentContextBlock = `${shortProfile}${shortLesson}${shortPast}${shortMistakes}`;";
code = code.replace(targetContextBlock, replacementContextBlock);

// Update rules
const targetRules = "- ANTI-REPETITION (CRITICAL): Do NOT generate sentences that are structurally identical or extremely similar to the sentences listed in PAST EXERCISES. The user should learn to understand the language dynamically, not memorize specific sentence structures by heart. Create new contexts, subjects, and scenarios.";
const replacementRules = `- ANTI-REPETITION & CONTEXT (CRITICAL): Jeśli uczeń kontynuuje ćwiczenie (ćwiczy dłużej), kategorycznie NIE powtarzaj tych samych ani podobnych zdań, które znajdują się w PAST EXERCISES. Buduj zupełnie nowe, świeże scenariusze i konteksty, ale utrzymaj docelowe słownictwo.
- LEARNING FROM MISTAKES: Jeśli dostarczono sekcję [STUDENT MISTAKES], skup się na wygenerowaniu zdań, które ćwiczą trudne dla ucznia obszary (np. błędnie użyte słowa lub konstrukcje gramatyczne). Zdania muszą pokazywać wyraźny, życiowy kontekst poprawnego użycia, aby uczeń zrozumiał błąd i mógł się poprawić.`;
code = code.replace(targetRules, targetRules + "\\n" + replacementRules);

fs.writeFileSync('services/geminiService.ts', code);
