const fs = require('fs');
let code = fs.readFileSync('components/dashboard/LessonHistory.tsx', 'utf-8');

const target = `              {lesson.studentSpeaking && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-[#242424]">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    Student Speaking
                  </div>
                  <div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{lesson.studentSpeaking}</div>
                </div>
              )}

              {lesson.thingsToImprove && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-[#2a1616]">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Things to Improve
                  </div>
                  <div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{lesson.thingsToImprove}</div>
                </div>
              )}

              {lesson.suggestedFollowUp && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-[#2a2816]">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    Suggested follow-up
                  </div>
                  <div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{lesson.suggestedFollowUp}</div>
                </div>
              )}`;

const replacement = ``;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/LessonHistory.tsx', code);
