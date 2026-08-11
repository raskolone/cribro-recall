import React, { useState, useEffect } from 'react';

interface FillInTheBlankTaskProps {
  textWithBlanks: string;
  availableWords: string[];
  studentAnswers: Record<string, string>;
  onAnswerChange: (blanks: Record<string, string>) => void;
}

export const FillInTheBlankTask: React.FC<FillInTheBlankTaskProps> = ({
  textWithBlanks,
  availableWords,
  studentAnswers,
  onAnswerChange
}) => {
  const [draggedWord, setDraggedWord] = useState<string | null>(null);

  // Parse text to identify blanks
  const parts = textWithBlanks.split(/(\[BLANK_\d+\])/g);

  const handleDragStart = (e: React.DragEvent, word: string) => {
    setDraggedWord(word);
    e.dataTransfer.setData('text/plain', word);
  };

  const handleDrop = (e: React.DragEvent, blankId: string) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('text/plain');
    if (word) {
      const newAnswers = { ...studentAnswers, [blankId]: word };
      onAnswerChange(newAnswers);
    }
    setDraggedWord(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemoveWord = (blankId: string) => {
    const newAnswers = { ...studentAnswers };
    delete newAnswers[blankId];
    onAnswerChange(newAnswers);
  };

  // Filter out words that are already used
  const usedWords = Object.values(studentAnswers);
  const remainingWords = availableWords.filter(w => !usedWords.includes(w));

  return (
    <div className="space-y-6">
      {/* Word Bank */}
      <div className="p-4 rounded-xl bg-base-300/50 border border-white/5 flex flex-wrap gap-2">
        {remainingWords.map((word, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={(e) => handleDragStart(e, word)}
            className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg cursor-grab active:cursor-grabbing font-medium text-sm transition-transform hover:scale-105"
          >
            {word}
          </div>
        ))}
        {remainingWords.length === 0 && (
          <span className="text-sm text-content-muted italic">Brak słówek do wykorzystania.</span>
        )}
      </div>

      {/* Text with blanks */}
      <div className="p-5 rounded-xl bg-base-200/80 border border-white/10 text-white font-medium text-base leading-loose">
        {parts.map((part, idx) => {
          const isBlank = part.startsWith('[BLANK_') && part.endsWith(']');
          if (!isBlank) {
            return <span key={idx}>{part}</span>;
          }
          
          const blankId = part.replace('[', '').replace(']', '');
          const filledWord = studentAnswers[blankId];

          return (
            <span
              key={idx}
              onDrop={(e) => handleDrop(e, blankId)}
              onDragOver={handleDragOver}
              onClick={() => filledWord && handleRemoveWord(blankId)}
              className={`inline-block min-w-[100px] text-center mx-1 px-3 py-1 rounded border-b-2 ${
                filledWord
                  ? 'bg-primary/20 text-primary border-primary cursor-pointer hover:bg-red-500/20 hover:text-red-400 hover:border-red-400 hover:line-through'
                  : 'bg-base-300 border-white/30 border-dashed text-content-muted'
              }`}
            >
              {filledWord || '...'}
            </span>
          );
        })}
      </div>
      <p className="text-xs text-content-muted italic text-right mt-2">
        Przeciągnij i upuść słówka w odpowiednie luki. (Kliknij wypełnioną lukę, aby ją wyczyścić)
      </p>
    </div>
  );
};