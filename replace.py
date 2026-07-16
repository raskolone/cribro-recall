import sys

with open('components/tests/TakeTestScreen.tsx', 'r') as f:
    content = f.read()

with open('/tmp/target.txt', 'r') as f:
    target = f.read()

replacement = """        {test.questions.map((q, idx) => (
          <Card key={q.id} className="p-6 md:p-8 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-2xl">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="font-bold text-primary text-lg w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-6 w-full overflow-hidden">
                <div>
                  <div className="text-sm font-bold text-content-muted mb-2 uppercase tracking-wider">
                    {q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : 'Tłumaczenie'}
                  </div>
                  <div className="font-medium text-xl leading-relaxed">{q.prompt}</div>
                  {q.hint && <div className="mt-3 text-sm text-content-muted/80 italic flex items-center gap-2"><span>💡</span> Wskazówka: {q.hint}</div>}
                </div>
                
                {q.type === 'multiple_choice' && q.options && (
                  <div className="space-y-3">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${answers[q.id] === opt ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] text-primary' : 'bg-base-100 border-white/10 hover:border-primary/50'}`}>
                        <input 
                          type="radio" 
                          name={`q_${q.id}`} 
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => handleAnswerChange(q.id, opt)}
                          className="accent-primary w-5 h-5"
                        />
                        <span className="font-medium text-base">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {(q.type === 'fill_in_blank' || q.type === 'translation') && (
                  <div>
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      placeholder={q.type === 'translation' ? "Przetłumacz na angielski..." : "Wpisz brakujący fragment..."}
                      className="w-full bg-base-100 border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>
                )}
                
                {q.type === 'matching' && q.options && (
                  <div className="space-y-4">
                    <div className="text-sm text-content-muted">Przepisz połączone pary (oddzielone znakiem równości =):</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 opacity-80">
                        {q.options.map((opt, j) => {
                            const p = opt.split('=');
                            return (
                                <div key={j} className="p-3 border border-white/10 rounded-xl bg-base-100 flex items-center justify-between text-sm">
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
                      placeholder="Wpisz połączone pary, np:\njabłko = apple\npies = dog"
                      className="w-full bg-base-100 border border-white/10 rounded-xl p-4 text-base outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all h-32 resize-y font-mono"
                    />
                  </div>
                )}
                
                {q.type === 'writing' && (
                  <div>
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Napisz swoją odpowiedź tutaj..."
                      className="w-full bg-base-100 border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all h-40 resize-y"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}"""

if target in content:
    with open('components/tests/TakeTestScreen.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Success")
else:
    print("Failed")
