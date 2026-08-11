sed -i '873i \              <div className="md:col-span-2">\
                <label className="block text-xs font-semibold text-content-muted mb-1">Źródło słownictwa (z lekcji)</label>\
                <select\
                  value={selectedLessonId}\
                  onChange={(e) => setSelectedLessonId(e.target.value)}\
                  className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"\
                >\
                  <option value="manual">Manualnie (brak przypisanej lekcji)</option>\
                  {studentLessons.map((lesson) => (\
                    <option key={lesson.id} value={lesson.id}>\
                      {new Date(lesson.date).toLocaleDateString()} - {lesson.topic}\
                    </option>\
                  ))}\
                </select>\
              </div>' components/dashboard/HomeworkScreen.tsx
