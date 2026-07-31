const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

const target1 = `            return (
              <div key={item.id} className="h-32 rounded-xl border-2 border-dashed border-green-500/30 bg-green-500/5 opacity-50 transition-all duration-500" />
            );`;
const new1 = `            return (
              <div key={item.id} className="h-24 md:h-32 rounded-xl border-2 border-dashed border-green-500/30 bg-green-500/5 opacity-50 transition-all duration-500" />
            );`;
code = code.replace(target1, new1);

const target2 = `          return (
            <Card 
              key={item.id}
              className={\`h-32 flex items-center justify-center text-center cursor-pointer transition-all duration-200 select-none \${
                isSelected ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' : 
                isWrong ? 'border-red-500 bg-red-500/10 animate-shake' : 
                'hover:border-base-300 hover:bg-base-200/50'
              }\`}
              onClick={() => handleItemClick(item)}
            >
              <span className="font-medium text-lg" dangerouslySetInnerHTML={{ __html: item.text }} />
            </Card>
          );`;
const new2 = `          return (
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
code = code.replace(target2, new2);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', code);
