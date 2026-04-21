import React, { useState, useEffect, useMemo } from 'react';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { FlashcardSet, Flashcard, StudySession, SessionResult } from '../../types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface FlashcardStatsScreenProps {
  setId: string;
  onBack: () => void;
}

const FlashcardStatsScreen: React.FC<FlashcardStatsScreenProps> = ({ setId, onBack }) => {
  const { sets, getFlashcards, sessions, getSessionResults } = useFlashcards();
  const { t, language } = useLanguage();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cardStats, setCardStats] = useState<Record<string, { correct: number; incorrect: number; lastPracticed: Date | null }>>({});

  const setSessions = useMemo(() => {
    return sessions
      .filter(s => s.setId === setId)
      .sort((a, b) => (a.completedAt?.toMillis() || 0) - (b.completedAt?.toMillis() || 0));
  }, [sessions, setId]);

  useEffect(() => {
    const currentSet = sets.find(s => s.id === setId);
    if (currentSet) {
      setSet(currentSet);
    }
    
    const loadData = async () => {
      const loadedCards = await getFlashcards(setId);
      setCards(loadedCards);
      
      // Load results for all sessions of this set
      const stats: Record<string, { correct: number; incorrect: number; lastPracticed: Date | null }> = {};
      
      loadedCards.forEach(c => {
        stats[c.id] = { correct: 0, incorrect: 0, lastPracticed: null };
      });
      
      for (const session of setSessions) {
        const results = await getSessionResults(session.id);
        results.forEach(r => {
          if (stats[r.flashcardId]) {
            if (r.isCorrect) stats[r.flashcardId].correct++;
            else stats[r.flashcardId].incorrect++;
            
            if (session.completedAt) {
              const sessionDate = session.completedAt.toDate();
              if (!stats[r.flashcardId].lastPracticed || sessionDate > stats[r.flashcardId].lastPracticed!) {
                stats[r.flashcardId].lastPracticed = sessionDate;
              }
            }
          }
        });
      }
      
      setCardStats(stats);
      setIsLoading(false);
    };
    
    loadData();
  }, [setId, sets, getFlashcards, setSessions, getSessionResults]);

  const lineChartData = useMemo(() => {
    return setSessions.slice(-7).map((s, i) => ({
      name: `S${i + 1}`,
      accuracy: s.scorePercent,
      date: s.completedAt?.toDate().toLocaleDateString()
    }));
  }, [setSessions]);

  const barChartData = useMemo(() => {
    return setSessions.slice(-7).map((s, i) => ({
      name: `S${i + 1}`,
      known: s.correctCount,
      unknown: s.totalCards - s.correctCount,
    }));
  }, [setSessions]);

  const lastSession = setSessions[setSessions.length - 1];

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; {language === 'pl' ? 'Wróć' : 'Back'}
        </button>
        <h2 className="text-2xl font-bold">{set?.title} - {language === 'pl' ? 'Statystyki' : 'Statistics'}</h2>
      </div>

      {setSessions.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-content-muted">{language === 'pl' ? 'Brak danych. Rozpocznij naukę, aby zobaczyć statystyki.' : 'No data. Start studying to see statistics.'}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider mb-4">
                {language === 'pl' ? 'Ostatnia sesja' : 'Last Session'}
              </h3>
              <div className="text-4xl font-black text-primary mb-2">{lastSession?.scorePercent}%</div>
              <div className="text-sm text-content-muted">
                {lastSession?.completedAt?.toDate().toLocaleDateString()} • {lastSession?.mode}
              </div>
            </Card>

            <Card className="md:col-span-2">
              <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider mb-4">
                {language === 'pl' ? 'Dokładność (ostatnie 7 sesji)' : 'Accuracy (last 7 sessions)'}
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#16181d', borderColor: '#22252b' }}
                      itemStyle={{ color: '#4ade80' }}
                    />
                    <Line type="monotone" dataKey="accuracy" stroke="#4ade80" strokeWidth={3} dot={{ r: 4, fill: '#4ade80' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider mb-4">
              {language === 'pl' ? 'Znane vs Nieznane' : 'Known vs Unknown'}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#16181d', borderColor: '#22252b' }}
                  />
                  <Bar dataKey="known" name={language === 'pl' ? 'Znane' : 'Known'} stackId="a" fill="#4ade80" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="unknown" name={language === 'pl' ? 'Nieznane' : 'Unknown'} stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider mb-4">
              {language === 'pl' ? 'Fiszki w zestawie' : 'Cards in set'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-base-300">
                    <th className="py-3 px-4 font-medium text-content-muted">{language === 'pl' ? 'Pojęcie' : 'Term'}</th>
                    <th className="py-3 px-4 font-medium text-content-muted">{language === 'pl' ? 'Definicja' : 'Definition'}</th>
                    <th className="py-3 px-4 font-medium text-content-muted text-center">{language === 'pl' ? 'Poprawne' : 'Correct'}</th>
                    <th className="py-3 px-4 font-medium text-content-muted text-center">{language === 'pl' ? 'Błędne' : 'Incorrect'}</th>
                    <th className="py-3 px-4 font-medium text-content-muted text-right">{language === 'pl' ? 'Ostatnio' : 'Last'}</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map(card => {
                    const stats = cardStats[card.id] || { correct: 0, incorrect: 0, lastPracticed: null };
                    return (
                      <tr key={card.id} className="border-b border-base-300/50 hover:bg-base-300/20 transition-colors">
                        <td className="py-3 px-4 font-medium" dangerouslySetInnerHTML={{ __html: card.term }} />
                        <td className="py-3 px-4 text-content-muted" dangerouslySetInnerHTML={{ __html: card.definition }} />
                        <td className="py-3 px-4 text-center text-green-400 font-mono">{stats.correct}</td>
                        <td className="py-3 px-4 text-center text-red-400 font-mono">{stats.incorrect}</td>
                        <td className="py-3 px-4 text-right text-content-muted text-sm">
                          {stats.lastPracticed ? stats.lastPracticed.toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default FlashcardStatsScreen;
