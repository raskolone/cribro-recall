import React, { useEffect, useMemo, useState } from 'react';

type Word = {
  id: string;
  term: string;
  translation: string;
  category: string;
  createdAt: string;
};

type SessionStats = {
  totalWords: number;
  attempts: number;
  correctAnswers: number;
  currentStreak: number;
  accuracy: number;
};

type QuizResult = {
  correct: boolean;
  expected: string;
  normalizedAnswer: string;
  stats: SessionStats;
};

const API_BASE_URL = 'http://127.0.0.1:8000';

const starterPalette = {
  page: '#f5efe6',
  panel: '#fffaf3',
  ink: '#1d3124',
  muted: '#5f6f65',
  accent: '#d06b31',
  accentDark: '#8e3d16',
  line: '#e6d7c4',
  success: '#2f7a49',
  danger: '#a64032',
};

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  return response.json() as Promise<T>;
}

const StarterVocabularyApp: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string>('');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<QuizResult | null>(null);
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [category, setCategory] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWord = useMemo(
    () => words.find((word) => word.id === selectedWordId) ?? words[0] ?? null,
    [selectedWordId, words],
  );

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [nextWords, nextStats] = await Promise.all([
        readJson<Word[]>('/words'),
        readJson<SessionStats>('/stats'),
      ]);
      setWords(nextWords);
      setStats(nextStats);
      setSelectedWordId((currentWordId) => currentWordId || nextWords[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się połączyć z backendem.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddWord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const createdWord = await readJson<Word>('/words', {
        method: 'POST',
        body: JSON.stringify({ term, translation, category }),
      });

      setWords((currentWords) => [createdWord, ...currentWords]);
      setSelectedWordId(createdWord.id);
      setTerm('');
      setTranslation('');
      setCategory('daily');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się dodać słówka.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuizSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWord) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await readJson<QuizResult>('/quiz/check', {
        method: 'POST',
        body: JSON.stringify({ wordId: selectedWord.id, answer }),
      });
      setFeedback(result);
      setStats(result.stats);
      setAnswer('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się sprawdzić odpowiedzi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, #fff7ec 0%, ${starterPalette.page} 40%, #efe2d1 100%)`,
        color: starterPalette.ink,
        padding: '32px 20px 56px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: starterPalette.accentDark, fontSize: 12, margin: 0 }}>
            TypeScript + Python starter
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', lineHeight: 1, margin: '10px 0 14px' }}>
            Vocabulary Trainer
          </h1>
          <p style={{ maxWidth: 760, color: starterPalette.muted, fontSize: 18, lineHeight: 1.6, margin: 0 }}>
            Prosty projekt do nauki budowania aplikacji od podstaw: frontend w TypeScript zarządza widokami i formularzami, a backend w Pythonie przechowuje dane, sprawdza odpowiedzi i liczy postęp.
          </p>
        </header>

        {error ? (
          <section style={{ background: '#fff1eb', border: `1px solid #f0c3b8`, color: starterPalette.danger, padding: 16, borderRadius: 18, marginBottom: 20 }}>
            <strong>Backend niedostępny.</strong> {error}
            <div style={{ marginTop: 8, color: starterPalette.muted }}>
              Uruchom FastAPI poleceniem <code>uvicorn python_api.main:app --reload</code>.
            </div>
          </section>
        ) : null}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {[
            { label: 'Słówka', value: stats?.totalWords ?? words.length },
            { label: 'Próby', value: stats?.attempts ?? 0 },
            { label: 'Poprawne', value: stats?.correctAnswers ?? 0 },
            { label: 'Accuracy', value: `${stats?.accuracy ?? 0}%` },
          ].map((metric) => (
            <article key={metric.label} style={{ background: starterPalette.panel, border: `1px solid ${starterPalette.line}`, borderRadius: 24, padding: 20, boxShadow: '0 14px 40px rgba(108, 77, 52, 0.08)' }}>
              <div style={{ color: starterPalette.muted, fontSize: 14 }}>{metric.label}</div>
              <div style={{ fontSize: 32, marginTop: 8, fontWeight: 700 }}>{metric.value}</div>
            </article>
          ))}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <article style={{ background: starterPalette.panel, border: `1px solid ${starterPalette.line}`, borderRadius: 28, padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Dodaj słówko</h2>
            <form onSubmit={handleAddWord} style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>English term</span>
                <input value={term} onChange={(event) => setTerm(event.target.value)} required placeholder="airport" style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Polskie tłumaczenie</span>
                <input value={translation} onChange={(event) => setTranslation(event.target.value)} required placeholder="lotnisko" style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Kategoria</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)} style={inputStyle}>
                  <option value="daily">daily</option>
                  <option value="travel">travel</option>
                  <option value="food">food</option>
                  <option value="work">work</option>
                </select>
              </label>
              <button disabled={submitting} type="submit" style={buttonStyle}>
                {submitting ? 'Zapisywanie...' : 'Dodaj słówko'}
              </button>
            </form>
          </article>

          <article style={{ background: starterPalette.panel, border: `1px solid ${starterPalette.line}`, borderRadius: 28, padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Quiz</h2>
            {loading ? (
              <p style={{ color: starterPalette.muted }}>Ładowanie danych...</p>
            ) : selectedWord ? (
              <form onSubmit={handleQuizSubmit} style={{ display: 'grid', gap: 14 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Wybierz słówko</span>
                  <select value={selectedWord.id} onChange={(event) => setSelectedWordId(event.target.value)} style={inputStyle}>
                    {words.map((word) => (
                      <option key={word.id} value={word.id}>
                        {word.term} ({word.category})
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ padding: 18, borderRadius: 20, background: '#fff6ea', border: `1px solid ${starterPalette.line}` }}>
                  <div style={{ color: starterPalette.muted, fontSize: 14, marginBottom: 6 }}>Przetłumacz na polski</div>
                  <div style={{ fontSize: 30, fontWeight: 700 }}>{selectedWord.term}</div>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Twoja odpowiedź</span>
                  <input value={answer} onChange={(event) => setAnswer(event.target.value)} required placeholder="Wpisz tłumaczenie" style={inputStyle} />
                </label>

                <button disabled={submitting} type="submit" style={buttonStyle}>
                  {submitting ? 'Sprawdzanie...' : 'Sprawdź odpowiedź'}
                </button>
              </form>
            ) : (
              <p style={{ color: starterPalette.muted }}>Dodaj pierwsze słówko, aby uruchomić quiz.</p>
            )}

            {feedback ? (
              <div style={{ marginTop: 18, padding: 18, borderRadius: 20, background: feedback.correct ? '#edf8ef' : '#fff1eb', border: `1px solid ${feedback.correct ? '#b7debf' : '#f0c3b8'}` }}>
                <strong style={{ color: feedback.correct ? starterPalette.success : starterPalette.danger }}>
                  {feedback.correct ? 'Dobra odpowiedź.' : 'Jeszcze nie.'}
                </strong>
                <div style={{ marginTop: 8 }}>Poprawna odpowiedź: {feedback.expected}</div>
                <div style={{ marginTop: 4, color: starterPalette.muted }}>Znormalizowana odpowiedź: {feedback.normalizedAnswer}</div>
                <div style={{ marginTop: 8 }}>Aktualna seria: {feedback.stats.currentStreak}</div>
              </div>
            ) : null}
          </article>
        </section>

        <section style={{ marginTop: 20, background: starterPalette.panel, border: `1px solid ${starterPalette.line}`, borderRadius: 28, padding: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Lista słówek</h2>
          {words.length === 0 ? (
            <p style={{ color: starterPalette.muted, marginBottom: 0 }}>Brak danych. Dodaj kilka słówek i wróć do quizu.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {words.map((word) => (
                <article key={word.id} style={{ border: `1px solid ${starterPalette.line}`, borderRadius: 18, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{word.term}</strong>
                    <div style={{ color: starterPalette.muted, marginTop: 4 }}>{word.translation}</div>
                  </div>
                  <div style={{ color: starterPalette.muted }}>{word.category}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: `1px solid ${starterPalette.line}`,
  padding: '13px 14px',
  fontSize: 16,
  background: '#fffdf8',
  color: starterPalette.ink,
};

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '14px 18px',
  fontSize: 16,
  fontWeight: 700,
  background: `linear-gradient(135deg, ${starterPalette.accent} 0%, ${starterPalette.accentDark} 100%)`,
  color: '#fff7f1',
  cursor: 'pointer',
};

export default StarterVocabularyApp;