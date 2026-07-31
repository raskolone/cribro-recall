const fs = require('fs');
let code = fs.readFileSync('components/practice/QuizExercise.tsx', 'utf8');

if (!code.includes('TTSButtons')) {
  code = code.replace("import Button from '../ui/Button';", "import Button from '../ui/Button';\nimport TTSButtons from '../flashcards/TTSButtons';");
}

const targetOptionRender = `            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={!!selectedAnswer}
                className={\`w-full p-4 rounded-lg border-2 text-center transition-colors duration-200 disabled:cursor-not-allowed \${buttonClass}\`}
              >
                {option}
              </button>
            );`;

const newOptionRender = `            return (
              <div key={option} className="relative">
                <button
                  onClick={() => handleAnswer(option)}
                  disabled={!!selectedAnswer}
                  className={\`w-full p-4 pr-12 rounded-lg border-2 text-center transition-colors duration-200 disabled:cursor-not-allowed \${buttonClass}\`}
                >
                  {option}
                </button>
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <TTSButtons text={option} />
                </div>
              </div>
            );`;

code = code.replace(targetOptionRender, newOptionRender);
fs.writeFileSync('components/practice/QuizExercise.tsx', code);
