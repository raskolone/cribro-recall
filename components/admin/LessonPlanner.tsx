import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User as UserIcon, Copy, Check, Clock, 
  BookOpen, Target, Layers, Lightbulb, RefreshCw, ChevronRight, 
  Trash2, AlertCircle, ArrowRight, FileText, Zap, Brain, MessageSquare
} from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getAI } from '../../services/geminiService';
import { User, LessonRecord } from '../../types';

interface UserWithId extends User {
  id: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedTopic?: string;
  extractedVocab?: string;
}

interface LessonPlannerProps {
  selectedUser?: UserWithId | null;
  users: UserWithId[];
  onSelectUser?: (user: UserWithId | null) => void;
  recentLessons?: LessonRecord[];
  onInsertLessonRecord?: (data: { topic: string; summary: string; vocabulary: string; followUp: string }) => void;
}

const QUICK_PROMPTS = [
  {
    title: 'Lekcja konwersacyjna (B2)',
    desc: 'Dyskusja, pytania, idiomy i zwroty',
    prompt: 'Przygotuj 50-minutową lekcję konwersacyjną na poziomie B2 o temacie "Sztuczna inteligencja i przyszłość pracy". Przygotuj pytania do dyskusji, 8 zaawansowanych kolokacji z tłumaczeniem na polski oraz mini-debatę.'
  },
  {
    title: 'Business English: Negocjacje',
    desc: 'Zwroty dyplomatyczne i symulacja',
    prompt: 'Stwórz plan lekcji Business English na temat "Wpływowe negocjacje i dyplomatyczny język". Dołącz listę kluczowych zwrotów z polskim tłumaczeniem, ćwiczenie controlled practice oraz scenariusz role-play.'
  },
  {
    title: 'Gramatyka w kontekście',
    desc: 'Mixed Conditionals z ćwiczeniami',
    prompt: 'Przygotuj scenariusz lekcji gramatycznej skupionej na "Mixed Conditionals (okresy warunkowe mieszane)". Wyjaśnij zasady zwięźle po polsku, podaj 6 przykładów, pytania konwersacyjne wymuszające użycie tej struktury oraz 5 zdań do tłumaczenia PL->EN.'
  },
  {
    title: 'Plan 3 kolejnych lekcji',
    desc: 'Cykl tematyczny z celami',
    prompt: 'Zaprojektuj spójny cykl 3 kolejnych lekcji rozwijających płynność mówienia i słownictwo branżowe. Dla każdej lekcji podaj: Cel, Główne słownictwo (6-8 pozycji), Pytania do rozmowy oraz Zadanie podsumowujące.'
  }
];

export const LessonPlanner: React.FC<LessonPlannerProps> = ({
  selectedUser,
  users,
  onSelectUser,
  recentLessons = [],
  onInsertLessonRecord
}) => {
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: `### 👋 Witaj w Planerze Lekcji AI! (Wersja robocza)

Jestem Twoim asystentem metodycznym. Pomogę Ci błyskawicznie przygotować:
- **Kompletne scenariusze 50- lub 60-minutowych lekcji** (rozgrzewka, słownictwo, pytania do dyskusji, symulacje, podsumowanie),
- **Lekcje gramatyczne w naturalnym kontekście** z ćwiczeniami i tłumaczeniami,
- **Zestawy słownictwa i kolokacji z polskimi odpowiednikami** gotowe do wygenerowania fiszek,
- **Spersonalizowane plany** oparte na dotychczasowych lekcjach i poziomie kursanta.

*Wybierz jeden z gotowych szablonów poniżej lub wpisz własny temat zajęć.*`,
      timestamp: new Date()
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lessonDuration, setLessonDuration] = useState('50 min');
  const [targetLevel, setTargetLevel] = useState<string>(selectedUser?.level || 'B2');
  const [lessonType, setLessonType] = useState('Konwersacje');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update target level when selectedUser changes
  useEffect(() => {
    if (selectedUser?.level) {
      setTargetLevel(selectedUser.level);
    }
  }, [selectedUser]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // If not admin, show draft banner
  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-white/10 bg-base-200/50 p-8 text-center max-w-xl mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-warn/15 border border-warn/30 text-warn flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-extrabold text-white mb-2">Planer lekcji (Wersja robocza)</h3>
        <p className="text-sm text-content-muted">
          Ten moduł jest obecnie w fazie przygotowania i jest dostępny wyłącznie dla Administratora systemu. Wkrótce zostanie udostępniony wszystkim lektorom.
        </p>
      </div>
    );
  }

  const buildSystemPrompt = () => {
    let studentContext = '';
    if (selectedUser) {
      const studentName = selectedUser.firstName || selectedUser.username || 'Kursant';
      studentContext = `
DANE KURSANTA:
- Imię: ${studentName}
- Aktualny poziom CEFR: ${selectedUser.level || targetLevel || 'B2'}
- Cel i opis kursanta: ${selectedUser.description || 'brak dodatkowego opisu'}
${selectedUser.aiPrompt ? `- Specjalne wytyczne nauczyciela dla tego kursanta: ${selectedUser.aiPrompt}` : ''}
`;

      if (recentLessons && recentLessons.length > 0) {
        const lastFew = recentLessons.slice(0, 3);
        studentContext += `
OSTATNIE LEKCJE KURSANTA (weź pod uwagę tematy i unikaj powtórzeń, nawiąż do kontynuacji):
${lastFew.map((l, i) => `- Lekcja ${i + 1} (${l.date}): Temat: "${l.topic}". ${l.thingsToImprove ? `Błędy do wyeliminowania: ${l.thingsToImprove}` : ''}`).join('\n')}
`;
      }
    }

    return `Jesteś doświadczonym metodykiem języka angielskiego (Senior ESL Curriculum Designer & Master Teacher) w szkole językowej.
Tworzysz angażujące, praktyczne i nowoczesne plany lekcji dostosowane do dorosłych kursantów.

PARAMETRY LEKCJI:
- Czas trwania: ${lessonDuration}
- Poziom docelowy: ${targetLevel}
- Profil/Tryb: ${lessonType}
${studentContext}

ZASADY TWORZENIA SCENARIUSZA:
1. Odpowiadaj zawsze po polsku z zachowaniem angielskich materiałów dydaktycznych (angielskie słownictwo, pytania, zdania, dialogi).
2. Struktura scenariusza powinna być czytelna i gotowa do użycia na żywej lekcji:
   - **Tytuł i cel lekcji** (krótki, praktyczny cel komunikacyjny)
   - **Rozgrzewka (Warm-up / Lead-in)**: 3-4 ciekawe pytania aktywujące wiedzę
   - **Kluczowe słownictwo i kolokacje**: 8-12 naturalnych zwrotów w formacie: \`Angielski zwrot - Polskie tłumaczenie\` + krótkie przykładowe zdanie użycia
   - **Główna aktywność / Dyskusja (Core Speaking Activity)**: Pytania problemowe, scenariusz mini-debaty lub case study / role-play
   - **Struktura gramatyczna / Focus frazeologiczny w kontekście**: 1 kluczowa struktura gramatyczna z 4-5 zdaniami do przećwiczenia lub przetłumaczenia (PL -> EN)
   - **Podsumowanie & Zadanie domowe / Follow-up**: 1-2 propozycje zadania utrwalającego.
3. Jeśli użytkownik prosi o modyfikację, doprecyzowanie lub inne ćwiczenie – zachowaj kontekst rozmowy i elastycznie zrealizuj prośbę.
4. Używaj estetycznego formatowania Markdown (nagłówki ##, pogrubienia, listy punktowane).`;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const systemInstruction = buildSystemPrompt();

      // Format conversation history for Gemini
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const contents = [
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ];

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const responseText = response?.text || 'Przepraszam, nie udało się wygenerować planu lekcji. Spróbuj ponownie.';

      // Extract vocabulary if present
      let extractedVocab = '';
      const lines = responseText.split('\n');
      const vocabLines: string[] = [];
      lines.forEach(line => {
        const trimmed = line.trim();
        if ((trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) && (trimmed.includes(' - ') || trimmed.includes(' – ') || trimmed.includes(':'))) {
          const cleanLine = trimmed.replace(/^[-*\d.]+\s*/, '').trim();
          if (cleanLine.length > 3 && cleanLine.length < 120) {
            vocabLines.push(cleanLine);
          }
        }
      });
      if (vocabLines.length >= 3) {
        extractedVocab = vocabLines.join('\n');
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        extractedVocab
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Błąd generatora planera lekcji:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Wystąpił błąd podczas generowania planu: ${err.message || 'Brak połączenia z modelem AI'}. Spróbuj ponownie za chwilę.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleClearChat = () => {
    if (window.confirm('Czy na pewno chcesz wyczyścić historię czatu w planerze?')) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `### 🔄 Czat zresetowany. O czym ma być kolejna lekcja?`,
          timestamp: new Date()
        }
      ]);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-base-200/90 to-base-200/80 p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary text-accent-ink font-bold flex items-center justify-center shadow-[0_0_20px_rgba(114,240,180,0.35)] shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Planer lekcji AI
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-warn/20 text-warn border border-warn/30 text-[10px] uppercase font-bold tracking-wider">
                  Draft • Widok Admina
                </span>
              </div>
              <p className="text-xs sm:text-sm text-content-muted mt-0.5">
                Generuj kompletne scenariusze zajęć, materiały konwersacyjne i zestawy słownictwa dostosowane do kursanta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Wyczyść historię rozmowy"
            >
              <Trash2 size={13} />
              <span>Nowy plan</span>
            </button>
          </div>
        </div>

        {/* Configuration Bar: Student Selector & Parameters */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Student picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <UserIcon size={12} className="text-primary" />
              Kursant:
            </label>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const found = users.find(u => u.id === e.target.value);
                if (onSelectUser) onSelectUser(found || null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none"
            >
              <option value="">-- Tryb ogólny (bez kursanta) --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName || u.username} ({u.level || 'B2'})
                </option>
              ))}
            </select>
          </div>

          {/* Level picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Target size={12} className="text-primary" />
              Poziom CEFR:
            </label>
            <select
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none font-bold text-primary"
            >
              {['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'].map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} className="text-primary" />
              Czas trwania:
            </label>
            <select
              value={lessonDuration}
              onChange={(e) => setLessonDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none"
            >
              {['30 min', '45 min', '50 min', '60 min', '90 min'].map(dur => (
                <option key={dur} value={dur}>{dur}</option>
              ))}
            </select>
          </div>

          {/* Lesson Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Layers size={12} className="text-primary" />
              Typ zajęć:
            </label>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none"
            >
              {[
                'Konwersacje i Płynność',
                'Business English',
                'Gramatyka w kontekście',
                'Przygotowanie do egzaminu',
                'Specjalistyczny / Branżowy',
                'Powtórka i analiza błędów'
              ].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Prompts Chips */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-content-muted uppercase tracking-wider">
          <Lightbulb size={13} className="text-warn" />
          <span>Szybkie szablony zapytań:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isLoading}
              className="p-3 rounded-2xl bg-base-200/60 hover:bg-base-200 border border-white/10 hover:border-primary/40 text-left transition-all group active:scale-[0.98] flex flex-col justify-between"
            >
              <div>
                <h4 className="font-bold text-white text-xs group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>{qp.title}</span>
                  <Zap size={11} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
                <p className="text-[11px] text-content-muted mt-1 line-clamp-2">
                  {qp.desc}
                </p>
              </div>
              <span className="text-[10px] text-primary/80 font-medium mt-2 flex items-center gap-1">
                Generuj <ArrowRight size={10} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className="rounded-3xl border border-white/10 bg-base-200/40 backdrop-blur-md overflow-hidden flex flex-col min-h-[480px]">
        {/* Messages List */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[620px]">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/20 border border-primary/30 text-primary flex items-center justify-center shrink-0 mt-1">
                    <Bot size={18} />
                  </div>
                )}

                <div className={`max-w-3xl ${isUser ? 'w-auto' : 'w-full'}`}>
                  <div
                    className={`rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary text-accent-ink font-medium shadow-md'
                        : 'bg-base-100/90 border border-white/10 text-content shadow-lg'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-invert max-w-none text-sm leading-relaxed [&>h2]:text-primary [&>h3]:text-white [&>h2]:text-base [&>h3]:text-sm [&>ul]:space-y-1 [&>ol]:space-y-1">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>

                  {/* Assistant Actions Bar */}
                  {!isUser && msg.id !== 'welcome' && (
                    <div className="flex items-center gap-2 mt-2 ml-1 text-xs text-content-muted flex-wrap">
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 font-medium"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} className="text-primary" />
                            <span className="text-primary">Skopiowano konspekt!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Kopiuj konspekt</span>
                          </>
                        )}
                      </button>

                      {msg.extractedVocab && (
                        <button
                          onClick={() => handleCopyText(`${msg.id}-vocab`, msg.extractedVocab || '')}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 font-medium"
                        >
                          {copiedId === `${msg.id}-vocab` ? (
                            <>
                              <Check size={12} className="text-primary" />
                              <span className="text-primary">Skopiowano słówka!</span>
                            </>
                          ) : (
                            <>
                              <BookOpen size={12} className="text-primary" />
                              <span>Kopiuj tylko słownictwo</span>
                            </>
                          )}
                        </button>
                      )}

                      <span className="text-[10px] text-content-muted ml-auto font-mono">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-ink-2 border border-white/10 text-white flex items-center justify-center shrink-0 mt-1 font-bold text-xs">
                    JA
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 sm:gap-4 justify-start items-center">
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                <Bot size={18} className="animate-spin-slow" />
              </div>
              <div className="rounded-2xl bg-base-100/80 border border-primary/30 p-4 text-xs font-bold text-primary flex items-center gap-3 animate-pulse">
                <Sparkles size={16} />
                <span>AI tworzy spersonalizowany scenariusz lekcji...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-base-100/90 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Napisz, o czym ma być lekcja (np. 'Lekcja o negocjacjach cenowych dla managera, poziom B2, 10 słówek i role-play')..."
                rows={2}
                className="w-full p-3.5 pr-10 text-sm bg-base-200/80 border border-white/15 rounded-2xl text-white placeholder-content-muted focus:border-primary/60 focus:outline-none resize-none transition-colors"
                disabled={isLoading}
              />
              <div className="absolute right-3 bottom-3 text-[10px] text-content-muted hidden sm:block">
                Enter ↵ wyślij • Shift+Enter nowa linia
              </div>
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="px-5 py-3.5 rounded-2xl bg-primary text-accent-ink font-extrabold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(114,240,180,0.3)] flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              {isLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              <span>Generuj plan</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LessonPlanner;
