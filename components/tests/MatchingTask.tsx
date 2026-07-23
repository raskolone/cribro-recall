import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface MatchingTaskProps {
  options: string[];
  onChange: (answer: string) => void;
  initialAnswer?: string;
}

export const MatchingTask: React.FC<MatchingTaskProps> = ({ options, onChange, initialAnswer }) => {
  // options format is typically ["left1 = right1", "left2 = right2"]
  // We need to split them and shuffle the right side.
  
  const [leftItems, setLeftItems] = useState<{id: string, text: string}[]>([]);
  const [rightItems, setRightItems] = useState<{id: string, text: string}[]>([]);
  
  // matches: leftId -> rightId
  const [matches, setMatches] = useState<Record<string, string>>({});

  useEffect(() => {
    const left: {id: string, text: string}[] = [];
    const right: {id: string, text: string}[] = [];
    
    options.forEach((opt, idx) => {
      const parts = opt.split('=');
      if (parts.length >= 2) {
        left.push({ id: \`L\${idx}\`, text: parts[0].trim() });
        right.push({ id: \`R\${idx}\`, text: parts[1].trim() });
      }
    });
    
    setLeftItems(left);
    
    // Shuffle right items
    const shuffledRight = [...right].sort(() => Math.random() - 0.5);
    setRightItems(shuffledRight);
    
    // Parse initial answer if any
    if (initialAnswer) {
      const parsedMatches: Record<string, string> = {};
      const lines = initialAnswer.split('\\n');
      lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const lText = parts[0].trim();
          const rText = parts[1].trim();
          const lItem = left.find(l => l.text === lText);
          const rItem = right.find(r => r.text === rText);
          if (lItem && rItem) {
            parsedMatches[lItem.id] = rItem.id;
          }
        }
      });
      setMatches(parsedMatches);
    }
  }, [options]);

  const updateAnswer = (newMatches: Record<string, string>) => {
    setMatches(newMatches);
    const answerString = Object.entries(newMatches).map(([lId, rId]) => {
      const lText = leftItems.find(l => l.id === lId)?.text;
      const rText = rightItems.find(r => r.id === rId)?.text;
      return \`\${lText} = \${rText}\`;
    }).join('\\n');
    onChange(answerString);
  };

  const handleDragStart = (e: React.DragEvent, id: string, source: 'pool' | 'slot', leftId?: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, source, leftId }));
  };

  const handleDropOnSlot = (e: React.DragEvent, targetLeftId: string) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { id, source, leftId } = data;
      
      const newMatches = { ...matches };
      
      // If there's already an item in the target slot, we need to swap or return it to pool
      const existingItemInTarget = newMatches[targetLeftId];
      
      if (source === 'pool') {
        newMatches[targetLeftId] = id;
      } else if (source === 'slot' && leftId) {
        // Move from one slot to another
        delete newMatches[leftId];
        newMatches[targetLeftId] = id;
        
        // If target had an item, swap it to the source slot
        if (existingItemInTarget) {
          newMatches[leftId] = existingItemInTarget;
        }
      }
      
      updateAnswer(newMatches);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { id, source, leftId } = data;
      
      if (source === 'slot' && leftId) {
        const newMatches = { ...matches };
        delete newMatches[leftId];
        updateAnswer(newMatches);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const availableRightItems = rightItems.filter(r => !Object.values(matches).includes(r.id));

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Left side: Questions and Slots */}
      <div className="flex-1 space-y-4">
        <h4 className="text-sm font-bold text-content-muted mb-4 uppercase tracking-wider">Połącz w pary</h4>
        {leftItems.map(left => {
          const matchedRightId = matches[left.id];
          const matchedRight = rightItems.find(r => r.id === matchedRightId);
          
          return (
            <div key={left.id} className="flex items-center gap-4">
              <div className="flex-1 p-4 bg-black/20 border border-white/5 rounded-xl text-white font-medium">
                {left.text}
              </div>
              <div 
                className={\`flex-1 p-4 rounded-xl border-2 border-dashed transition-all \${matchedRight ? 'border-primary/50 bg-primary/10' : 'border-white/20 bg-black/10'}\`}
                onDragOver={allowDrop}
                onDrop={(e) => handleDropOnSlot(e, left.id)}
              >
                {matchedRight ? (
                  <div 
                    draggable
                    onDragStart={(e) => handleDragStart(e, matchedRight.id, 'slot', left.id)}
                    className="p-3 bg-primary text-black font-bold rounded-lg cursor-grab active:cursor-grabbing shadow-[0_0_15px_rgba(114,240,180,0.3)] text-center"
                  >
                    {matchedRight.text}
                  </div>
                ) : (
                  <div className="text-content-muted/50 text-center text-sm font-medium">Przeciągnij tutaj</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right side: Available options */}
      <div 
        className="md:w-1/3 min-h-[200px] p-6 rounded-2xl bg-base-200/50 border border-white/10"
        onDragOver={allowDrop}
        onDrop={handleDropOnPool}
      >
        <h4 className="text-sm font-bold text-content-muted mb-4 uppercase tracking-wider">Dostępne opcje</h4>
        <div className="flex flex-col gap-3">
          {availableRightItems.map(right => (
            <div
              key={right.id}
              draggable
              onDragStart={(e) => handleDragStart(e, right.id, 'pool')}
              className="p-3 bg-base-100 border border-white/10 text-white font-medium rounded-lg cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors text-center"
            >
              {right.text}
            </div>
          ))}
          {availableRightItems.length === 0 && (
            <div className="text-center text-content-muted text-sm italic py-8">
              Wszystkie opcje wykorzystane.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
