const fs = require('fs');

let content = fs.readFileSync('components/tests/MatchingTask.tsx', 'utf8');

// Replace the draggable div in the slot
content = content.replace(
  /<div\s+draggable\s+onDragStart=\{\(e\) => handleDragStart\(e, matchedRight.id, 'slot', left.id\)\}\s+className="p-3 bg-primary text-black font-bold rounded-lg cursor-grab active:cursor-grabbing shadow-\[0_0_15px_rgba\(114,240,180,0.3\)\] text-center"\s+>/g,
  `<motion.div
                    layoutId={matchedRight.id}
                    draggable
                    onDragStart={(e: any) => handleDragStart(e, matchedRight.id, 'slot', left.id)}
                    className="p-3 bg-primary text-black font-bold rounded-lg cursor-grab active:cursor-grabbing shadow-[0_0_15px_rgba(114,240,180,0.3)] text-center"
                  >`
);

content = content.replace(
  /<\/div>\s+\) : \(/g,
  `</motion.div>
                ) : (`
);

// Replace the draggable div in the pool
content = content.replace(
  /<div\s+key=\{right.id\}\s+draggable\s+onDragStart=\{\(e\) => handleDragStart\(e, right.id, 'pool'\)\}\s+className="p-3 bg-base-100 border border-white\/10 text-white font-medium rounded-lg cursor-grab active:cursor-grabbing hover:border-primary\/50 transition-colors text-center"\s+>/g,
  `<motion.div
              key={right.id}
              layoutId={right.id}
              draggable
              onDragStart={(e: any) => handleDragStart(e, right.id, 'pool')}
              className="p-3 bg-base-100 border border-white/10 text-white font-medium rounded-lg cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors text-center"
            >`
);

content = content.replace(
  /\{right.text\}\s+<\/div>/g,
  `{right.text}
            </motion.div>`
);

// Wrap left item block in motion for smoothness
content = content.replace(/<div key=\{left.id\} className="flex items-center gap-4">/g, '<motion.div layout key={left.id} className="flex items-center gap-4">');
content = content.replace(/<\/div>\s+<div \s+className=\{`flex-1/g, '</div>              <div className={`flex-1');
content = content.replace(/<\/div>\s+\);\s+\}\)\}/g, '</div>            </motion.div>          );\n        })}');

fs.writeFileSync('components/tests/MatchingTask.tsx', content);

