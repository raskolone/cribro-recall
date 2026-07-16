import fs from 'fs';
const content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const target = `      {/* Jenga Blocks Animation */}
      <div ref={jengaRef} className="relative w-48 h-36 flex flex-col justify-end items-center mb-8 gap-[2px]">
        {/* We'll make 5 rows of 3 blocks each */}
        {[...Array(5)].map((_, rowIndex) => (
          <div key={\`row-\${rowIndex}\`} className={\`flex \${rowIndex % 2 === 0 ? 'flex-row gap-[2px]' : 'flex-col gap-[2px]'}\`}>
            {[...Array(3)].map((_, colIndex) => (
              <div 
                key={\`block-\${rowIndex}-\${colIndex}\`}
                className={\`jenga-block bg-primary/20 border border-primary/40 rounded-sm shadow-[0_0_10px_rgba(114,240,180,0.2)] \${rowIndex % 2 === 0 ? 'w-10 h-[14px]' : 'w-[124px] h-[10px]'}\`}
              />
            ))}
          </div>
        ))}
      </div>`;

const replacement = `      {/* Jenga Blocks Animation */}
      <div ref={jengaRef} className="relative w-48 h-36 flex flex-col justify-end items-center mb-8 gap-[2px]">
        {[...Array(6)].map((_, rowIndex) => (
          <div key={\`row-\${rowIndex}\`} className="flex flex-row gap-[2px]">
            {rowIndex % 2 === 0 ? (
              [...Array(3)].map((_, colIndex) => (
                <div 
                  key={\`block-\${rowIndex}-\${colIndex}\`}
                  className="jenga-block bg-primary/20 border border-primary/40 rounded-sm shadow-[0_0_10px_rgba(114,240,180,0.2)] w-[38px] h-[16px]"
                />
              ))
            ) : (
               <div 
                  key={\`block-\${rowIndex}-0\`}
                  className="jenga-block bg-primary/20 border border-primary/40 rounded-sm shadow-[0_0_10px_rgba(114,240,180,0.2)] w-[118px] h-[16px]"
                />
            )}
          </div>
        ))}
      </div>`;

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content.replace(target, replacement));
