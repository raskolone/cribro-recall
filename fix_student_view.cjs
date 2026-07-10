const fs = require('fs');
let code = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf-8');

const target = `          {selectedLesson.thingsToImprove && (
            <div className="relative z-10 space-y-3 mt-8">
               <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500"></div>
                 {language === 'pl' ? 'Do poprawy' : 'Things to Improve'}
               </h3>
               <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-content">
                  <div className="markdown-body text-sm leading-relaxed prose prose-invert max-w-none">
                    <Markdown>{selectedLesson.thingsToImprove}</Markdown>
                  </div>
               </div>
            </div>
          )}

          {selectedLesson.suggestedFollowUp && (
            <div className="relative z-10 space-y-3 mt-8">
               <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                 {language === 'pl' ? 'Rekomendacje' : 'Suggested follow-up'}
               </h3>
               <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-6 text-content">
                  <div className="markdown-body text-sm leading-relaxed prose prose-invert max-w-none">
                    <Markdown>{selectedLesson.suggestedFollowUp}</Markdown>
                  </div>
               </div>
            </div>
          )}

          {(!selectedLesson.lessonSummary && vocabList.length === 0 && !selectedLesson.thingsToImprove && !selectedLesson.suggestedFollowUp) && (
            <div className="relative z-10 text-center p-8 text-content-muted">
              {language === 'pl' ? 'Ta lekcja nie ma przypisanego podsumowania ani słownictwa.' : 'This lesson has no summary or vocabulary attached.'}
            </div>
          )}`;

const replacement = `          {(!selectedLesson.lessonSummary && vocabList.length === 0) && (
            <div className="relative z-10 text-center p-8 text-content-muted">
              {language === 'pl' ? 'Ta lekcja nie ma przypisanego podsumowania ani słownictwa.' : 'This lesson has no summary or vocabulary attached.'}
            </div>
          )}`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', code);
