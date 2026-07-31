const fs = require('fs');
let code = fs.readFileSync('components/practice/FillInBlankExercise.tsx', 'utf8');

if (!code.includes('TTSButtons')) {
  code = code.replace("import Button from '../ui/Button';", "import Button from '../ui/Button';\nimport TTSButtons from '../flashcards/TTSButtons';");
}

const targetHtml = `<h2 className="text-2xl font-bold">{i18n.t("Fill in the Blank")}</h2>`;
const newHtml = `<div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">{i18n.t("Fill in the Blank")}</h2>
          <TTSButtons text={currentWord.example.replace(currentWord.word, 'blank')} />
        </div>`;

code = code.replace(targetHtml, newHtml);
fs.writeFileSync('components/practice/FillInBlankExercise.tsx', code);
