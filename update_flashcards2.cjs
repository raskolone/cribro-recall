const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

const targetBlock = `{/* Front Side */}
                <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-primary/50 transition-colors" style={{ backfaceVisibility: 'hidden' }}>
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <PronunciationMic targetWord={isReversed ? currentCard.definition.replace(/<[^>]+>/g, '') : currentCard.term.replace(/<[^>]+>/g, '')} />
                    <TTSButtons text={currentCard.term} />
                  </div>
                  <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
                  <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.term }} />
                </Card>
                
                {/* Back Side */}
                <Card 
                  className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-primary/50 shadow-[0_0_30px_rgba(114,240,180,0.15)]" 
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <TTSButtons text={currentCard.definition} />
                  </div>
                  <div className="text-sm font-mono text-primary uppercase tracking-widest mb-8">{t('flashcards.definition')}</div>
                  <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.definition }} />
                </Card>`;

const replacementBlock = `{/* Front Side */}
                <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-primary/50 transition-colors" style={{ backfaceVisibility: 'hidden' }}>
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <PronunciationMic targetWord={isReversed ? currentCard.definition.replace(/<[^>]+>/g, '') : currentCard.term.replace(/<[^>]+>/g, '')} />
                    <TTSButtons text={isReversed ? currentCard.definition : currentCard.term} />
                  </div>
                  <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{isReversed ? t('flashcards.definition') : t('flashcards.term')}</div>
                  <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: isReversed ? currentCard.definition : currentCard.term }} />
                </Card>
                
                {/* Back Side */}
                <Card 
                  className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-primary/50 shadow-[0_0_30px_rgba(114,240,180,0.15)]" 
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <TTSButtons text={isReversed ? currentCard.term : currentCard.definition} />
                  </div>
                  <div className="text-sm font-mono text-primary uppercase tracking-widest mb-8">{isReversed ? t('flashcards.term') : t('flashcards.definition')}</div>
                  <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: isReversed ? currentCard.term : currentCard.definition }} />
                </Card>`;

file = file.replace(targetBlock, replacementBlock);
fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
