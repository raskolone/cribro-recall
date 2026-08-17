import re

with open('components/landing/LandingPage.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "import { Sparkles, Brain, Activity, Ear, Mail, ChevronRight, CheckCircle2, Star, Lightbulb, Play } from 'lucide-react';",
    "import { Sparkles, Brain, Activity, Ear, Mail, ChevronRight, CheckCircle2, Star, Lightbulb, Play, Users, BookOpen, Settings, CheckSquare, PenTool, ArrowRight, GraduationCap, Trophy, Globe, Lock, Shield } from 'lucide-react';"
)

# 2. Insert new content before `          </div>\n        </div>\n      </main>\n    </div>\n  );\n};`

new_content = """
            {/* Divider */}
            <div className="col-span-1 lg:col-span-2 py-16">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
              <div className="text-center mt-8">
                <span className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                  {language === 'pl' ? 'Dla Nauczycieli' : 'For Teachers'}
                </span>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mt-4 mb-4">
                  {language === 'pl' ? 'Pełnooperacyjne narzędzie do zarządzania kursantami' : 'Full-scale student management tool'}
                </h2>
                <p className="text-content-muted max-w-3xl mx-auto text-lg">
                  {language === 'pl' 
                    ? 'Stworzone dla freelancerów i tutorów języka angielskiego (wkrótce również innych języków). Zarządzaj uczniami, przydzielaj zadania i śledź ich postępy w jednym miejscu.' 
                    : 'Built for English language freelancers and tutors (soon other languages too). Manage students, assign tasks, and track progress all in one place.'}
                </p>
              </div>
            </div>

            {/* Tutor Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 col-span-1 lg:col-span-2">
              <div className="liquid-glass-card p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <Users className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{language === 'pl' ? 'Zarządzanie Kursantami' : 'Student Management'}</h3>
                <p className="text-content-muted text-sm">{language === 'pl' ? 'Pełna lista uczniów z podglądem ich aktywności, historii lekcji i ogólnych postępów.' : 'Full list of students with an overview of their activity, lesson history, and overall progress.'}</p>
              </div>
              <div className="liquid-glass-card p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <BookOpen className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{language === 'pl' ? 'Zestawy i Lekcje' : 'Sets & Lessons'}</h3>
                <p className="text-content-muted text-sm">{language === 'pl' ? 'Twórz i przypisuj konkretne zestawy słownictwa oraz całe historie lekcji bezpośrednio do profili uczniów.' : 'Create and assign specific vocabulary sets and full lesson histories directly to student profiles.'}</p>
              </div>
              <div className="liquid-glass-card p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <CheckSquare className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{language === 'pl' ? 'Prace Domowe i Testy' : 'Homework & Tests'}</h3>
                <p className="text-content-muted text-sm">{language === 'pl' ? 'Zlecaj prace domowe i testy z dokładnymi terminami wykonania, aby skutecznie weryfikować wiedzę.' : 'Assign homework and tests with exact deadlines to effectively verify knowledge.'}</p>
              </div>
            </div>

            {/* Tutor Mockup */}
            <div className="mt-8 col-span-1 lg:col-span-2">
              <MockupWindow title={language === 'pl' ? 'Panel Nauczyciela' : 'Teacher Dashboard'}>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
                    <h4 className="text-lg font-bold text-white">{language === 'pl' ? 'Podgląd Ucznia: Jan Kowalski' : 'Student Overview: John Doe'}</h4>
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Poziom: B2</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <h5 className="text-sm text-content-muted font-bold uppercase tracking-widest mb-3">{language === 'pl' ? 'Ostatnie Zadania' : 'Recent Tasks'}</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                          <span className="text-gray-300">Test: Present Perfect</span>
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">92%</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                          <span className="text-gray-300">Praca domowa (Lekcja 4)</span>
                          <span className="text-yellow-400 font-bold bg-yellow-500/10 px-2 py-0.5 rounded">W trakcie</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <h5 className="text-sm text-content-muted font-bold uppercase tracking-widest mb-3">{language === 'pl' ? 'Szybkie Akcje' : 'Quick Actions'}</h5>
                      <div className="space-y-2">
                        <button className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 p-2.5 rounded-lg text-sm font-bold transition-colors">
                          + {language === 'pl' ? 'Przypisz zadanie' : 'Assign Task'}
                        </button>
                        <button className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 p-2.5 rounded-lg text-sm transition-colors">
                          {language === 'pl' ? 'Wyślij zestaw słówek' : 'Send Vocab Set'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </MockupWindow>
            </div>

            {/* Divider */}
            <div className="col-span-1 lg:col-span-2 py-16">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
              <div className="text-center mt-8">
                <span className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
                  {language === 'pl' ? 'Dla Ucznia' : 'For Students'}
                </span>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mt-4 mb-4">
                  {language === 'pl' ? 'Twój osobisty asystent nauki' : 'Your personal study assistant'}
                </h2>
              </div>
            </div>

            {/* Student Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 col-span-1 lg:col-span-2">
              <div className="flex gap-4 p-6 liquid-glass-card items-start">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex-shrink-0 flex items-center justify-center text-purple-400 border border-purple-500/30">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-1">{language === 'pl' ? 'Inteligentne Powtórki' : 'Spaced Repetition'}</h4>
                  <p className="text-content-muted text-sm">{language === 'pl' ? 'System przypomina słówka w idealnym momencie, aby na zawsze zapisały się w Twojej pamięci długotrwałej.' : 'The system reminds you of words at the perfect time so they stick in your long-term memory.'}</p>
                </div>
              </div>
              <div className="flex gap-4 p-6 liquid-glass-card items-start">
                <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex-shrink-0 flex items-center justify-center text-pink-400 border border-pink-500/30">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-1">{language === 'pl' ? 'Pełna Kontrola Treningu' : 'Full Training Control'}</h4>
                  <p className="text-content-muted text-sm">{language === 'pl' ? 'Twórz własne zestawy słówek i elastycznie decyduj, z ilu zdań ma składać się dana sesja treningowa.' : 'Create your own vocab sets and flexibly decide how many sentences each training session should have.'}</p>
                </div>
              </div>
              <div className="flex gap-4 p-6 liquid-glass-card items-start">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex-shrink-0 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-1">{language === 'pl' ? 'Zadania od Lektora' : 'Tutor Assignments'}</h4>
                  <p className="text-content-muted text-sm">{language === 'pl' ? 'Otrzymuj i wykonuj prace domowe oraz dedykowane testy bezpośrednio z pulpitu Twojego konta.' : 'Receive and complete homework and dedicated tests directly from your dashboard.'}</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="col-span-1 lg:col-span-2 py-16">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>

            {/* Creator Card */}
            <div className="col-span-1 lg:col-span-2 flex justify-center pb-8">
              <div className="liquid-glass-card p-6 max-w-sm w-full border border-white/10 text-center flex flex-col items-center group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 rounded-full overflow-hidden mb-4 border-2 border-primary/40 group-hover:border-primary transition-colors relative z-10 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <img src="https://ui-avatars.com/api/?name=Maciej+Wyrozumski&background=10b981&color=fff&size=128" alt="Maciej Wyrozumski" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-primary font-mono uppercase tracking-widest mb-1 relative z-10 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  {language === 'pl' ? 'Strona twórcy Cribro' : 'Cribro Creator'}
                </span>
                <h4 className="text-xl font-bold text-white mb-2 relative z-10 mt-2">Maciej Wyrozumski</h4>
                <p className="text-sm text-content-muted mb-5 relative z-10 leading-relaxed">
                  {language === 'pl' ? 'Odkryj więcej moich projektów, narzędzi AI i rozwiązań webowych na moim portfolio.' : 'Discover more of my projects, AI tools, and web solutions on my portfolio.'}
                </p>
                <a 
                  href="https://www.maciej.pro" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/30 font-bold text-sm transition-all duration-300 flex items-center gap-2 relative z-10 group/btn"
                >
                  <Globe className="w-4 h-4 group-hover/btn:animate-spin-slow" /> www.maciej.pro
                </a>
              </div>
            </div>
"""

old_end = """          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;"""

new_end = new_content + """
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 bg-black/40 mt-auto z-10 relative">
        <div className="max-w-7xl mx-auto px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-content-muted text-sm text-center sm:text-left">
            &copy; {new Date().getFullYear()} Cribro. {language === 'pl' ? 'Wszelkie prawa zastrzeżone.' : 'All rights reserved.'}
          </div>
          <a href="mailto:wyrozumski@maciej.pro" className="flex items-center justify-center gap-2 text-content-muted hover:text-primary transition-colors text-sm bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/5">
            <Mail className="w-4 h-4" /> wyrozumski@maciej.pro
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;"""

content = content.replace(old_end, new_end)

with open('components/landing/LandingPage.tsx', 'w') as f:
    f.write(content)
