const fs = require('fs');

let content = fs.readFileSync('components/tests/TakeTestScreen.tsx', 'utf8');

// Add import if not exists
if (!content.includes('import { MatchingTask }')) {
  content = content.replace(/import \{ Link, useParams \} from 'react-router-dom';/, 
    "import { Link, useParams } from 'react-router-dom';\\nimport { MatchingTask } from './MatchingTask';");
}

const oldMatching = `{q.type === 'matching' && q.options && (
                  <div className="space-y-4">
                    <div className="text-sm text-content-muted">Przepisz połączone pary (oddzielone znakiem równości =):</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 opacity-80">
                        {q.options.map((opt, j) => {
                            const p = opt.split('=');
                            return (
                                <div key={j} className="p-3 border border-white/10 rounded-xl bg-black/30 backdrop-blur-sm flex items-center justify-between text-sm">
                                    <span>{p[0]?.trim()}</span>
                                    <span className="text-content-muted">/</span>
                                    <span>{p[1]?.trim()}</span>
                                </div>
                            );
                        })}
                    </div>
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Wpisz połączone pary, np:
jabłko = apple
pies = dog"
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white min-h-[150px] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    />
                  </div>
                )}`;

const newMatching = `{q.type === 'matching' && q.options && (
                  <MatchingTask 
                    options={q.options} 
                    initialAnswer={answers[q.id]} 
                    onChange={(ans) => handleAnswerChange(q.id, ans)} 
                  />
                )}`;

content = content.replace(oldMatching, newMatching);

fs.writeFileSync('components/tests/TakeTestScreen.tsx', content);

