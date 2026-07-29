const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

const target1 = `  const [isReversed, setIsReversed] = useState(false);`;
const replacement1 = `  const [isReversed, setIsReversed] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);`;

file = file.replace(target1, replacement1);

const target2 = `  const handleFlip = useCallback(() => {`;
const replacement2 = `  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
    touchCurrentRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    touchCurrentRef.current = e.touches[0].clientX;
    const diff = touchCurrentRef.current - touchStartRef.current;
    
    // Add visual feedback for swipe
    if (cardContainerRef.current && isFlipped) {
      gsap.to(cardContainerRef.current, {
        x: diff,
        rotation: diff * 0.05,
        duration: 0.1
      });
    } else if (cardContainerRef.current && !isFlipped) {
      gsap.to(cardContainerRef.current, {
        x: diff * 0.5, // resistance when not flipped
        rotation: diff * 0.02,
        duration: 0.1
      });
    }
  }, [isFlipped]);

  const handleTouchEnd = useCallback(() => {
    if (touchStartRef.current === null || touchCurrentRef.current === null) return;
    const diff = touchCurrentRef.current - touchStartRef.current;
    
    if (isFlipped) {
      if (diff > 80) {
        handleAnswer(true);
      } else if (diff < -80) {
        handleAnswer(false);
      } else {
        // snap back
        if (cardContainerRef.current) {
           gsap.to(cardContainerRef.current, { x: 0, rotation: 0, duration: 0.3, ease: "back.out(1.5)" });
        }
      }
    } else {
      if (diff > 80) {
        handlePrev();
      } else if (diff < -80) {
        handleNext();
      } else {
        // snap back
        if (cardContainerRef.current) {
           gsap.to(cardContainerRef.current, { x: 0, rotation: 0, duration: 0.3, ease: "back.out(1.5)" });
        }
      }
    }
    
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  }, [isFlipped, handleAnswer, handlePrev, handleNext]);

  const handleFlip = useCallback(() => {`;

file = file.replace(target2, replacement2);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
