const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const target = `    if (view === 'flashcard-study' && activeSetId) {
      return <React.Suspense fallback={<div>Loading...</div>}><FlashcardStudyScreen setId={activeSetId} onBack={() => setView('dashboard')} /></React.Suspense>;
    }`;
const replacement = `    if (view === 'flashcard-study' && activeSetId) {
      // Find initial mode from a state variable if we want, or pass via some context, 
      // but activeSetId is just a string. Let's add activeStudyMode state.
      return <React.Suspense fallback={<div>Loading...</div>}><FlashcardStudyScreen setId={activeSetId} initialMode={(window as any)._initialStudyMode} onBack={() => setView('dashboard')} /></React.Suspense>;
    }`;
code = code.replace(target, replacement);

const aiGenTarget = `    return <AIExerciseGeneratorScreen 
      onChangeView={(newView, extra) => {
        if (extra && extra.setId) setActiveSetId(extra.setId);
        setView(newView as View);
      }}`;
const aiGenReplacement = `    return <AIExerciseGeneratorScreen 
      onChangeView={(newView, extra) => {
        if (extra && extra.setId) setActiveSetId(extra.setId);
        if (extra && extra.initialMode) (window as any)._initialStudyMode = extra.initialMode;
        setView(newView as View);
      }}`;
code = code.replace(aiGenTarget, aiGenReplacement);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
