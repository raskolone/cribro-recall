const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// Fix them based on line number or content context
content = content.replace(
  /\{\(isLoading \|\| isEvaluating \|\| isGeneratingMore\) && \(\s*<motion\.div key="global-loader" /g,
  '{(isLoading || isEvaluating || isGeneratingMore) && (\n          <motion.div key="global-loader" '
);

content = content.replace(
  /\{error && \(\s*<motion\.div key="global-loader" /g,
  '{error && (\n          <motion.div key="error-banner" '
);

content = content.replace(
  /\{user\?\.hasNewVocabulary && !isBannerDismissed && \(\s*<motion\.div key="global-loader" /g,
  '{user?.hasNewVocabulary && !isBannerDismissed && (\n                <motion.div key="vocab-banner" '
);

content = content.replace(
  /\{isLessonSelectorOpen && \(\s*<motion\.div key="global-loader"/g,
  '{isLessonSelectorOpen && (\n                            <motion.div key="lesson-selector"'
);

content = content.replace(
  /\{expandedGrammarLevel === cIdx && \(\s*<motion\.div key="global-loader"/g,
  '{expandedGrammarLevel === cIdx && (\n                                          <motion.div key="grammar-level"'
);

content = content.replace(
  /\{previewVocabSet && \(\s*<motion\.div key="global-loader"/g,
  '{previewVocabSet && (\n                            <motion.div key="preview-modal"'
);

content = content.replace(
  /\{activeSentenceIndex > 0 && activeSentenceIndex % 3 === 0 && studentAnswers\[activeSentenceIndex - 1\]\?\.trim\(\) && \(\s*<motion\.div key="global-loader" /g,
  '{activeSentenceIndex > 0 && activeSentenceIndex % 3 === 0 && studentAnswers[activeSentenceIndex - 1]?.trim() && (\n                <motion.div key="motivating-bubble" '
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
console.log("Keys fixed!");
