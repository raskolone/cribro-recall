const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

// FlashcardsMode
file = file.replace(
  `  const [isFinished, setIsFinished] = useState(false);`,
  `  const [isFinished, setIsFinished] = useState(false);
  const [isReversed, setIsReversed] = useState(false);`
);

file = file.replace(
  `        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>`,
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
      </div>`
);

// We need to swap term and definition rendering in FlashcardsMode.
// Original front:
// <PronunciationMic targetWord={currentCard.term.replace(/<[^>]+>/g, '')} />
// <TTSButtons text={currentCard.term} />
// <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
// <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.term }} />

// We will replace these blocks.
file = file.replace(
  /<PronunciationMic targetWord={currentCard\.term\.replace\(\/<\^>\+>\/g, ''\)} \/>/g,
  `<PronunciationMic targetWord={isReversed ? currentCard.definition.replace(/<[^>]+>/g, '') : currentCard.term.replace(/<[^>]+>/g, '')} />`
);

// We should just use a general replacement for the Front and Back cards in FlashcardsMode.

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
