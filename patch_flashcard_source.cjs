const fs = require('fs');

let dashboardCode = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const targetFlashcardStudy = `    if (view === 'flashcard-study' && activeSetId) {
      // Find initial mode from a state variable if we want, or pass via some context, 
      // but activeSetId is just a string. Let's add activeStudyMode state.
      return <React.Suspense fallback={<div>Loading...</div>}><FlashcardStudyScreen setId={activeSetId} initialMode={(window as any)._initialStudyMode} onBack={() => setView('dashboard')} /></React.Suspense>;
    }`;
const newFlashcardStudy = `    if (view === 'flashcard-study') {
      return <React.Suspense fallback={<div>Loading...</div>}><FlashcardStudyScreen setId={activeSetId || ''} initialMode={(window as any)._initialStudyMode} onBack={() => setView('dashboard')} onNavigate={(v) => setView(v as View)} /></React.Suspense>;
    }`;

dashboardCode = dashboardCode.replace(targetFlashcardStudy, newFlashcardStudy);
fs.writeFileSync('components/dashboard/Dashboard.tsx', dashboardCode);

let fssCode = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');
const targetProps = `interface FlashcardStudyScreenProps {
  setId: string;
  initialMode?: StudyMode;
  onBack: () => void;
  onStartAIPractice?: () => void;
}`;
const newProps = `interface FlashcardStudyScreenProps {
  setId: string;
  initialMode?: StudyMode;
  onBack: () => void;
  onNavigate?: (view: string) => void;
  onStartAIPractice?: () => void;
}`;
fssCode = fssCode.replace(targetProps, newProps);

const targetComponentDef = `const FlashcardStudyScreen: React.FC<FlashcardStudyScreenProps> = ({ setId, initialMode = null, onBack, onStartAIPractice }) => {`;
const newComponentDef = `const FlashcardStudyScreen: React.FC<FlashcardStudyScreenProps> = ({ setId, initialMode = null, onBack, onNavigate, onStartAIPractice }) => {`;
fssCode = fssCode.replace(targetComponentDef, newComponentDef);

const targetUseEffect = `  useEffect(() => {
    const currentSet = sets.find(s => s.id === setId);
    if (currentSet) {
      setSet(currentSet);
    }
    
    const loadCards = async () => {
      const loadedCards = await getFlashcards(setId);
      setCards(loadedCards);
      setIsLoading(false);
    };
    
    loadCards();
  }, [setId, sets, getFlashcards]);`;

const newUseEffect = `  useEffect(() => {
    if (!setId) {
      setIsLoading(false);
      return;
    }
    const currentSet = sets.find(s => s.id === setId);
    if (currentSet) {
      setSet(currentSet);
    }
    
    const loadCards = async () => {
      const loadedCards = await getFlashcards(setId);
      setCards(loadedCards);
      setIsLoading(false);
    };
    
    loadCards();
  }, [setId, sets, getFlashcards]);`;

fssCode = fssCode.replace(targetUseEffect, newUseEffect);

const targetIsLoading = `  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }`;

const newIsLoading = `  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!setId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 mt-12 bg-base-200/50 rounded-3xl max-w-lg mx-auto text-center border border-white/10">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl mb-6">
          🗂️
        </div>
        <h2 className="text-2xl font-bold mb-4">{language === 'pl' ? 'Nie wybrano źródła' : 'No source selected'}</h2>
        <p className="text-content-muted mb-8 text-sm leading-relaxed">
          {language === 'pl' 
            ? 'Aby rozpocząć ćwiczenie (fiszki, dopasowanie), wybierz najpierw materiał w zakładce słownictwa, z którego chcesz się uczyć.' 
            : 'To start an exercise (flashcards, matching), please select the material you want to study from the vocabulary tab first.'}
        </p>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={onBack}>
            {language === 'pl' ? 'Wróć' : 'Back'}
          </Button>
          <Button className="bg-primary text-black font-bold" onClick={() => onNavigate && onNavigate('flashcard-sets')}>
            {language === 'pl' ? 'Przejdź do Słownictwa' : 'Go to Vocabulary'}
          </Button>
        </div>
      </div>
    );
  }`;

fssCode = fssCode.replace(targetIsLoading, newIsLoading);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', fssCode);
