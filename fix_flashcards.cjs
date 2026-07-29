const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

// Replace the commented out TTS in back of card with actual TTS for the definition.
// Search for: {/* Definition might not be strictly English... */}
file = file.replace(
  /{[^}]*Definition might not be strictly English[^}]*}/g,
  `<TTSButtons text={currentCard.definition} />`
);

// We should also replace it in the grid-flipped card mode (line 1040 is just TTSButtons for term, we should change it to definition since it's the back side)
file = file.replace(
  `          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-secondary/50 rotate-y-180">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <TTSButtons text={currentCard.term} />
            </div>`,
  `          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-secondary/50 rotate-y-180">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <TTSButtons text={currentCard.definition} />
            </div>`
);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
