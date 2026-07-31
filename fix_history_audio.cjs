const fs = require('fs');
let code = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

// import TTSButtons
if (!code.includes("import TTSButtons")) {
  code = code.replace(
    "import Button from '../ui/Button';",
    "import Button from '../ui/Button';\nimport TTSButtons from '../flashcards/TTSButtons';"
  );
}

// replace vocabulary display in history
code = code.replace(
  /<span className="font-bold text-white text-base">\{item\.word\}<\/span>/,
  `<div className="flex items-center justify-between gap-2">
                           <span className="font-bold text-white text-base">{item.word}</span>
                           <TTSButtons text={item.word} />
                         </div>`
);

fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', code);
