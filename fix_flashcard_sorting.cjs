const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

const targetStr = `  useEffect(() => {
    const shuffled = [...initialCards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setStartTime(Date.now());
  }, [initialCards]);`;

const replacementStr = `  const { getProgress } = useFlashcards();

  useEffect(() => {
    const loadCards = async () => {
      let progress: any[] = [];
      if (getProgress) {
         progress = await getProgress(setId);
      }
      
      const cardsWithProgress = initialCards.map((card: any) => {
        const prog = progress.find(p => p.flashcardId === card.id);
        return {
           ...card,
           nextReviewDate: prog?.nextReviewDate || '1970-01-01T00:00:00.000Z'
        };
      });

      cardsWithProgress.sort((a: any, b: any) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
      
      setCards(cardsWithProgress);
      setStartTime(Date.now());
    };
    loadCards();
  }, [initialCards, setId, getProgress]);`;

file = file.replace(targetStr, replacementStr);
fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
