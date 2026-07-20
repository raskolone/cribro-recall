import fs from 'fs';
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const target = `              ) : evaluationStatuses[activeSentenceIndex] !== 'evaluated' ? (
                <AILoadingButton
                  onClick={handleEvaluateSingle}
                  disabled={!studentAnswers[activeSentenceIndex]?.trim()}
                  isLoading={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                  loadingText={language === 'pl' ? 'Sprawdzanie...' : 'Checking...'}
                  className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                >
                  {language === 'pl' ? 'Sprawdź' : 'Check'}
                </AILoadingButton>
              ) : (`;

const replacement = `              ) : evaluationStatuses[activeSentenceIndex] !== 'evaluated' ? (
                <div className="flex gap-2">
                  <AILoadingButton
                    onClick={handleEvaluateSingle}
                    disabled={!studentAnswers[activeSentenceIndex]?.trim()}
                    isLoading={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                    loadingText={language === 'pl' ? 'Sprawdzanie...' : 'Checking...'}
                    className="px-6 py-3 bg-base-300 hover:bg-base-300/80 text-white font-bold"
                  >
                    {language === 'pl' ? 'Sprawdź aktualne' : 'Check current'}
                  </AILoadingButton>

                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore}
                      loadingText={language === 'pl' ? 'Ocenianie...' : 'Evaluating...'}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}
                    </AILoadingButton>
                  ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie...' : 'Loading...'}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>
                  )}
                </div>
              ) : (`;

content = content.replace(target, replacement);

const target2 = `                    <AILoadingButton
                      onClick={handleNext}
                      disabled={isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}
                      className="px-6 py-3"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>`;

const replacement2 = `                    <AILoadingButton
                      onClick={handleNext}
                      disabled={isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>`;

content = content.replace(target2, replacement2);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
console.log("Patched buttons");
