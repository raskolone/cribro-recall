import sys

with open('components/admin/AdminTestGenerator.tsx', 'r') as f:
    content = f.read()

with open('/tmp/target_admin.txt', 'r') as f:
    target = f.read()

replacement = """                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-2xl space-y-6 relative group transition-all">
                    <div className="flex items-start gap-4 md:gap-6">
                      <div className="font-bold text-primary text-lg w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-6 w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="text-sm font-bold text-content-muted uppercase tracking-wider">
                            {q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : 'Tłumaczenie'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => moveQuestion(i, 'up')} disabled={i === 0} className="p-2 rounded-lg bg-base-300 text-content hover:bg-white/10 disabled:opacity-30 transition-colors">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveQuestion(i, 'down')} disabled={i === generatedQuestions.length - 1} className="p-2 rounded-lg bg-base-300 text-content hover:bg-white/10 disabled:opacity-30 transition-colors">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-content-muted mb-2 uppercase tracking-wider">Treść Pytania</label>
                          <textarea
                            value={q.prompt}
                            onChange={(e) => updateQuestionPrompt(i, e.target.value)}
                            className="w-full bg-base-100 border border-white/10 rounded-xl p-4 text-white text-lg font-medium outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-y min-h-[80px]"
                          />
                        </div>
                        
                        {q.type === 'multiple_choice' && q.options && (
                          <div className="space-y-3">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">Opcje odpowiedzi (tylko odczyt)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {q.options.map((opt, j) => (
                                <div key={j} className={`p-4 rounded-xl border text-base font-medium transition-all ${opt === q.correctAnswer ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(114,240,180,0.1)] text-primary" : "border-white/10 bg-base-100 text-content-muted"}`}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {q.type === 'matching' && q.options && (
                          <div className="space-y-3">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">Pary (tylko odczyt)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {q.options.map((opt, j) => {
                                const parts = opt.split('=');
                                return (
                                  <div key={j} className="p-3 text-base bg-base-100 rounded-xl border border-white/10 flex items-center justify-between text-content-muted transition-all">
                                    <span className="font-medium">{parts[0]?.trim() || opt}</span>
                                    <span className="text-content-muted/50 mx-2">↔</span>
                                    <span className="text-primary font-medium">{parts[1]?.trim() || ''}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {q.type !== 'writing' && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                            <span className="text-xs font-bold uppercase text-primary tracking-wider shrink-0">Prawidłowa Odpowiedź:</span>
                            <span className="text-base font-medium text-white">{q.correctAnswer}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-6 border-t border-white/5 bg-base-200/50 space-y-4">
                <div>"""

if target in content:
    with open('components/admin/AdminTestGenerator.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Success")
else:
    print("Failed")
