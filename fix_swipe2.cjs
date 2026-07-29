const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

const touchHandlersStr = `  const handleTouchStart = useCallback((e: React.TouchEvent) => {
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
  }, [isFlipped, handleAnswer, handlePrev, handleNext]);`;

// Remove it from the current position
file = file.replace(touchHandlersStr, '');

// Insert it right after handleNext
const insertAfterStr = `  }, [currentIndex, cards.length]);`;
file = file.replace(insertAfterStr, insertAfterStr + '\n\n' + touchHandlersStr);

// Now attach them to the div
const divTarget = `            <div 
              ref={cardContainerRef}
              className="relative w-full aspect-[3/2] cursor-pointer"
              onClick={handleFlip}
            >`;
const divReplacement = `            <div 
              ref={cardContainerRef}
              className="relative w-full aspect-[3/2] cursor-pointer touch-pan-y"
              onClick={handleFlip}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >`;
file = file.replace(divTarget, divReplacement);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
