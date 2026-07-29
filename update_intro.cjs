const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

file = file.replace(
  `const IntroMode = ({ cards, onBack, t, showConfirm, closeConfirm }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);`,
  `const IntroMode = ({ cards, onBack, t, showConfirm, closeConfirm }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReversed, setIsReversed] = useState(false);`
);

file = file.replace(
  `        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">`,
  `        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsReversed(!isReversed)}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400"
          >
            {isReversed ? 'PL -> EN' : 'EN -> PL'}
          </button>
          <div className="font-mono text-sm">
            {currentIndex + 1} / {cards.length}
          </div>
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">`
);


const targetBlock = `<div className={\`w-full h-full transition-transform duration-500 transform-style-3d \${isFlipped ? 'rotate-y-180' : ''}\`}>
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-secondary/50 transition-colors">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <PronunciationMic targetWord={currentCard.term.replace(/<[^>]+>/g, '')} />
              <TTSButtons text={currentCard.term} />
            </div>
            <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
            <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.term }} />
          </Card>
          
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-secondary/50 rotate-y-180">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <TTSButtons text={currentCard.definition} />
            </div>
            <div className="text-sm font-mono text-secondary uppercase tracking-widest mb-8">{t('flashcards.definition')}</div>
            <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.definition }} />
          </Card>
        </div>`;

const replacementBlock = `<div className={\`w-full h-full transition-transform duration-500 transform-style-3d \${isFlipped ? 'rotate-y-180' : ''}\`}>
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-secondary/50 transition-colors">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <PronunciationMic targetWord={isReversed ? currentCard.definition.replace(/<[^>]+>/g, '') : currentCard.term.replace(/<[^>]+>/g, '')} />
              <TTSButtons text={isReversed ? currentCard.definition : currentCard.term} />
            </div>
            <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{isReversed ? t('flashcards.definition') : t('flashcards.term')}</div>
            <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: isReversed ? currentCard.definition : currentCard.term }} />
          </Card>
          
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-secondary/50 rotate-y-180">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <TTSButtons text={isReversed ? currentCard.term : currentCard.definition} />
            </div>
            <div className="text-sm font-mono text-secondary uppercase tracking-widest mb-8">{isReversed ? t('flashcards.term') : t('flashcards.definition')}</div>
            <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: isReversed ? currentCard.term : currentCard.definition }} />
          </Card>
        </div>`;

file = file.replace(targetBlock, replacementBlock);
fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
