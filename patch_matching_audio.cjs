const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

const targetMatchingRender = `          return (
            <Card 
              key={item.id}
              className={\`h-24 md:h-32 p-3 flex items-center justify-center text-center cursor-pointer transition-all duration-200 select-none touch-manipulation \${
                isSelected ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' : 
                isWrong ? 'border-red-500 bg-red-500/10 animate-shake' : 
                'hover:border-base-300 hover:bg-base-200/50'
              }\`}
              onClick={() => handleItemClick(item)}
            >
              <span className="font-medium text-sm md:text-lg leading-tight line-clamp-3" dangerouslySetInnerHTML={{ __html: item.text }} />
            </Card>
          );`;

const newMatchingRender = `          return (
            <Card 
              key={item.id}
              className={\`relative h-24 md:h-32 p-3 flex items-center justify-center text-center cursor-pointer transition-all duration-200 select-none touch-manipulation \${
                isSelected ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' : 
                isWrong ? 'border-red-500 bg-red-500/10 animate-shake' : 
                'hover:border-base-300 hover:bg-base-200/50'
              }\`}
              onClick={() => handleItemClick(item)}
            >
              <div className="absolute top-1 right-1" onClick={(e) => e.stopPropagation()}>
                <TTSButtons text={item.text} />
              </div>
              <span className="font-medium text-sm md:text-lg leading-tight line-clamp-3 mt-4" dangerouslySetInnerHTML={{ __html: item.text }} />
            </Card>
          );`;

code = code.replace(targetMatchingRender, newMatchingRender);
fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', code);
