const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const importTarget = "const TopicDatabaseScreen = React.lazy(() => import('../admin/TopicDatabaseScreen'));";
const newImports = importTarget + "\nconst FlashcardStudyScreen = React.lazy(() => import('../flashcards/FlashcardStudyScreen'));";
code = code.replace(importTarget, newImports);

const renderTarget = `    if (view === 'settings') {`;
const newRender = `    if (view === 'flashcard-study' && activeSetId) {
      return <React.Suspense fallback={<div>Loading...</div>}><FlashcardStudyScreen setId={activeSetId} onBack={() => setView('dashboard')} /></React.Suspense>;
    }
    if (view === 'settings') {`;
code = code.replace(renderTarget, newRender);

const aiGenTarget = `    return <AIExerciseGeneratorScreen />;`;
const aiGenNew = `    return <AIExerciseGeneratorScreen 
      onChangeView={(newView, extra) => {
        if (extra && extra.setId) setActiveSetId(extra.setId);
        setView(newView as View);
      }}
      onStartPractice={(type, mode1, mode2) => {
        // Fallback or specific logic if needed
      }}
    />;`;
code = code.replace(aiGenTarget, aiGenNew);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
