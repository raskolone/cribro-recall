const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetHeader = `        {/* Header */}
        <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            ✨ {isTeacher ? (language === 'pl' ? 'Widok kursanta' : 'Student View') : (language === 'pl' ? 'Panel ćwiczeniowy' : 'Practice Panel')}
          </h1>
          <p className="text-content-muted text-sm mt-1">
            {language === 'pl' 
              ? 'Ćwicz tłumaczenie zdań z języka polskiego na angielski na podstawie Twoich słówek i poziomu zaawansowania.'
              : 'Practice translating sentences from Polish to English based on your word lists and CEFR level.'}
          </p>

        </div>
        <div className="flex items-center gap-2">
          {isTeacher && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4" />
              {language === 'pl' ? 'Konfiguracja Promptu' : 'Prompt Setup'}
            </Button>
          )}`;

const replacementHeader = `        {/* Header */}
        <div className="hidden md:flex flex-col md:flex-row md:items-center justify-end gap-4 border-b border-base-300 pb-2">
        <div className="flex items-center gap-2">
          {isTeacher && (
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title={language === 'pl' ? 'Konfiguracja Promptu' : 'Prompt Setup'}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}`;

if (content.includes(targetHeader)) {
  content = content.replace(targetHeader, replacementHeader);
  fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
  console.log("Patched AIExerciseGeneratorScreen header!");
} else {
  console.log("Target header not found.");
}
