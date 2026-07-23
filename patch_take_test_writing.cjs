const fs = require('fs');
const file = 'components/tests/TakeTestScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /onCut=\{\(e\) => e.preventDefault\(\)\}\n                      placeholder="Zacznij pisać tutaj\.\.\."\n                      className="w-full bg-black\/30 backdrop-blur-sm border border-white\/10 rounded-xl p-4 text-lg outline-none focus:border-primary\/50 focus:ring-1 focus:ring-primary\/50 transition-all min-h-\[200px\] resize-y"/,
  'onCut={(e) => e.preventDefault()}\n                      placeholder="Zacznij pisać tutaj..."\n                      autoComplete="off"\n                      autoCorrect="off"\n                      spellCheck="false"\n                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[200px] resize-y"'
);

// We need to support 'find_mistake' similar to 'multiple_choice'
content = content.replace(
  /q\.type === 'multiple_choice' \? 'Wielokrotny wybór' :/,
  "q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'find_mistake' ? 'Wybór poprawnego zdania' :"
);

content = content.replace(
  /\{q\.type === 'multiple_choice' && q\.options && \(/,
  "{(q.type === 'multiple_choice' || q.type === 'find_mistake') && q.options && ("
);

fs.writeFileSync(file, content);
