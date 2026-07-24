import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import i18n from "i18next";
import { parseNumberedItems } from '../../utils/testFormatters';

interface WordBankFillInBlankTaskProps {
  prompt: string;
  correctAnswer: string;
  wordBank?: string[];
  options?: string[];
  onChange: (answer: string) => void;
  initialAnswer?: string;
  showFeedback?: boolean;
}

export const WordBankFillInBlankTask: React.FC<WordBankFillInBlankTaskProps> = ({
  prompt,
  correctAnswer,
  wordBank,
  options,
  onChange,
  initialAnswer,
  showFeedback = false,
}) => {
  const [bankWords, setBankWords] = useState<{ id: string; text: string }[]>([]);
  const [placedWords, setPlacedWords] = useState<Record<number, { id: string; text: string }>>({});
  const [selectedWordFromBank, setSelectedWordFromBank] = useState<{ id: string; text: string } | null>(null);

  const gapRegex = /_{2,}|\[blank\]|\( \)/g;

  // Parse sentences line by line
  const sentences = useMemo(() => parseNumberedItems(prompt), [prompt]);

  // Compute sentence structures and map gaps globally
  const { sentenceStructures, gapCount } = useMemo(() => {
    let globalIndex = 0;
    const structures = sentences.map(s => {
      const parts = s.text.split(gapRegex);
      const gapIndexes: number[] = [];
      const gapsInThisSentence = Math.max(0, parts.length - 1);
      for (let i = 0; i < gapsInThisSentence; i++) {
        gapIndexes.push(globalIndex++);
      }
      return {
        num: s.num,
        parts,
        gapIndexes
      };
    });
    return { sentenceStructures: structures, gapCount: Math.max(1, globalIndex) };
  }, [sentences]);

  // Parse correct answers
  const correctParts = useMemo(() => {
    return correctAnswer
      .split(/[,|\n|;]/)
      .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);
  }, [correctAnswer]);

  useEffect(() => {
    let rawList: string[] = [];
    if (wordBank && wordBank.length > 0) {
      rawList = [...wordBank];
    } else if (options && options.length > 0) {
      rawList = [...options];
    } else {
      rawList = [...correctParts];
    }

    correctParts.forEach(cp => {
      if (!rawList.some(w => w.toLowerCase() === cp.toLowerCase())) {
        rawList.push(cp);
      }
    });

    const items = rawList.map((text, idx) => ({
      id: `w_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      text,
    }));

    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setBankWords(shuffled);

    if (initialAnswer) {
      const initialParts = initialAnswer.split(/[,|\n|;]/).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim());
      const initialPlaced: Record<number, { id: string; text: string }> = {};
      const remainingBank = [...shuffled];

      initialParts.forEach((part, index) => {
        if (part && index < gapCount) {
          const matchIdx = remainingBank.findIndex(w => w.text.toLowerCase() === part.toLowerCase());
          if (matchIdx !== -1) {
            initialPlaced[index] = remainingBank[matchIdx];
            remainingBank.splice(matchIdx, 1);
          }
        }
      });
      setPlacedWords(initialPlaced);
      setBankWords(remainingBank);
    }
  }, [prompt, correctAnswer]);

  const updateAnswerString = (newPlaced: Record<number, { id: string; text: string }>) => {
    const answerArr: string[] = [];
    for (let i = 0; i < gapCount; i++) {
      answerArr.push(newPlaced[i]?.text || '');
    }
    onChange(answerArr.join(', '));
  };

  const placeWordInSlot = (slotIndex: number, wordObj: { id: string; text: string }) => {
    const existing = placedWords[slotIndex];
    const newPlaced = { ...placedWords, [slotIndex]: wordObj };
    const newBank = bankWords.filter(w => w.id !== wordObj.id);

    if (existing) {
      newBank.push(existing);
    }

    setPlacedWords(newPlaced);
    setBankWords(newBank);
    setSelectedWordFromBank(null);
    updateAnswerString(newPlaced);
  };

  const removeWordFromSlot = (slotIndex: number) => {
    const wordObj = placedWords[slotIndex];
    if (!wordObj) return;

    const newPlaced = { ...placedWords };
    delete newPlaced[slotIndex];

    setPlacedWords(newPlaced);
    setBankWords(prev => [...prev, wordObj]);
    updateAnswerString(newPlaced);
  };

  const handleDragStart = (e: React.DragEvent, wordObj: { id: string; text: string }, sourceSlot?: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ wordObj, sourceSlot }));
  };

  const handleDropOnSlot = (e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { wordObj, sourceSlot } = data;

      if (sourceSlot !== undefined && sourceSlot !== targetSlotIndex) {
        const existingInTarget = placedWords[targetSlotIndex];
        const newPlaced = { ...placedWords, [targetSlotIndex]: wordObj };
        if (existingInTarget) {
          newPlaced[sourceSlot] = existingInTarget;
        } else {
          delete newPlaced[sourceSlot];
        }
        setPlacedWords(newPlaced);
        updateAnswerString(newPlaced);
      } else if (sourceSlot === undefined) {
        placeWordInSlot(targetSlotIndex, wordObj);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDropOnBank = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { sourceSlot } = data;
      if (sourceSlot !== undefined) {
        removeWordFromSlot(sourceSlot);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const handleBankWordClick = (wordObj: { id: string; text: string }) => {
    if (selectedWordFromBank?.id === wordObj.id) {
      setSelectedWordFromBank(null);
      return;
    }

    let emptySlotIndex = -1;
    for (let i = 0; i < gapCount; i++) {
      if (!placedWords[i]) {
        emptySlotIndex = i;
        break;
      }
    }

    if (emptySlotIndex !== -1) {
      placeWordInSlot(emptySlotIndex, wordObj);
    } else {
      setSelectedWordFromBank(wordObj);
    }
  };

  const handleSlotClick = (slotIndex: number) => {
    if (placedWords[slotIndex] && !selectedWordFromBank) {
      removeWordFromSlot(slotIndex);
    } else if (selectedWordFromBank) {
      placeWordInSlot(slotIndex, selectedWordFromBank);
    }
  };

  return (
    <div className="space-y-6">
      {/* Word Bank Pool - Spacious Puzzle Board */}
      <div
        onDragOver={allowDrop}
        onDrop={handleDropOnBank}
        className="p-5 md:p-6 rounded-2xl bg-base-200/80 border border-primary/30 shadow-lg space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-primary uppercase tracking-wider">
              🧩 {i18n.t("Bank słów (rozsypka)")}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
              {bankWords.length} {i18n.t("dostępnych")}
            </span>
          </div>
          <span className="text-xs text-content-muted">
            {i18n.t("Przeciągnij słowo lub kliknij je, aby umieścić w luce")}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 min-h-[60px] items-center p-3 rounded-xl bg-black/30 border border-white/5">
          {bankWords.map(wordObj => {
            const isSelected = selectedWordFromBank?.id === wordObj.id;
            return (
              <motion.button
                key={wordObj.id}
                layoutId={wordObj.id}
                type="button"
                draggable
                onDragStart={(e: any) => handleDragStart(e, wordObj)}
                onClick={() => handleBankWordClick(wordObj)}
                className={`px-4 py-2.5 rounded-xl border-2 text-base font-bold transition-all cursor-grab active:cursor-grabbing select-none shadow-md ${
                  isSelected
                    ? 'bg-amber-400 text-black border-amber-300 ring-4 ring-amber-400/40 scale-105'
                    : 'bg-base-100 border-primary/40 text-white hover:border-primary hover:bg-primary/20 hover:scale-105'
                }`}
              >
                {wordObj.text}
              </motion.button>
            );
          })}

          {bankWords.length === 0 && (
            <div className="text-sm text-primary/80 font-medium italic py-2 flex items-center gap-2">
              <span>✨</span> {i18n.t("Wszystkie słowa z banku zostały umieszczone w lukach!")}
            </div>
          )}
        </div>
      </div>

      {/* Stacked Sentence Cards */}
      <div className="space-y-4">
        {sentenceStructures.map((struct, structIdx) => (
          <div key={structIdx} className="p-4 md:p-5 rounded-2xl bg-base-200/40 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {struct.num}
              </span>
              <span>Zdanie {struct.num}</span>
            </div>

            <div className="text-base md:text-lg font-medium text-white leading-relaxed flex flex-wrap items-center gap-2">
              {struct.parts.map((part, pIdx) => {
                const gapIdx = struct.gapIndexes[pIdx];
                return (
                  <React.Fragment key={pIdx}>
                    <span>{part}</span>
                    {gapIdx !== undefined && (
                      <span
                        onDragOver={allowDrop}
                        onDrop={e => handleDropOnSlot(e, gapIdx)}
                        onClick={() => handleSlotClick(gapIdx)}
                        className={`inline-flex items-center justify-center min-w-[120px] h-[48px] px-3.5 rounded-xl border-2 transition-all cursor-pointer select-none font-bold text-base ${
                          placedWords[gapIdx]
                            ? showFeedback
                              ? placedWords[gapIdx].text.toLowerCase() === (correctParts[gapIdx] || '').toLowerCase()
                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'border-red-500 bg-red-500/20 text-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                              : 'border-primary/80 bg-primary/20 text-primary shadow-[0_0_15px_rgba(114,240,180,0.25)]'
                            : selectedWordFromBank
                            ? 'border-amber-400 bg-amber-400/10 border-dashed text-amber-200 animate-pulse'
                            : 'border-dashed border-white/30 hover:border-primary/60 bg-white/5 text-content-muted'
                        }`}
                      >
                        {placedWords[gapIdx] ? (
                          <motion.span
                            layoutId={placedWords[gapIdx].id}
                            draggable
                            onDragStart={(e: any) => handleDragStart(e, placedWords[gapIdx], gapIdx)}
                            className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
                          >
                            <span>{placedWords[gapIdx].text}</span>
                            <span className="text-xs bg-black/40 hover:bg-black/80 rounded-full w-4 h-4 flex items-center justify-center text-white">✕</span>
                          </motion.span>
                        ) : (
                          <span className="text-xs text-content-muted/70 uppercase tracking-wider font-semibold">
                            {i18n.t("Luka")} {gapIdx + 1}
                          </span>
                        )}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordBankFillInBlankTask;
