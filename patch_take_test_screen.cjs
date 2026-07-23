const fs = require('fs');

let content = fs.readFileSync('components/tests/TakeTestScreen.tsx', 'utf8');

const oldRender = `<div className="text-sm font-bold text-content-muted mb-2 uppercase tracking-wider">
                    {q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'find_mistake' ? 'Wybór poprawnego zdania' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : 'Tłumaczenie'}
                  </div>
                  <div className="font-medium text-xl leading-relaxed">{q.prompt}</div>`;

const newRender = `<div className="text-sm font-bold text-content-muted mb-2 uppercase tracking-wider">
                    {q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'find_mistake' ? 'Wybór poprawnego zdania' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : 'Tłumaczenie'}
                  </div>
                  {q.instruction && (
                    <div className="font-bold text-primary text-lg mb-2">{q.instruction}</div>
                  )}
                  <div className="font-medium text-xl leading-relaxed">{q.prompt}</div>`;

content = content.replace(oldRender, newRender);

fs.writeFileSync('components/tests/TakeTestScreen.tsx', content);

