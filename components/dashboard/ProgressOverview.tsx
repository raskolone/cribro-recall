import React, { useMemo } from 'react';
import { useVocabulary } from '../../context/VocabularyContext';
import Card from '../ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const ProgressOverview: React.FC = () => {
  const { words, difficultWords, lastPractice } = useVocabulary();

  const stats = useMemo(() => {
    const totalWords = words.length;
    const difficultCount = difficultWords.length;
    const easyCount = totalWords - difficultCount;

    // Group by language
    const languageCounts: Record<string, number> = {};
    words.forEach(w => {
      languageCounts[w.language] = (languageCounts[w.language] || 0) + 1;
    });

    const languageData = Object.keys(languageCounts).map(lang => ({
      name: lang,
      count: languageCounts[lang]
    })).sort((a, b) => b.count - a.count);

    const difficultyData = [
      { name: 'Mastered', value: easyCount },
      { name: 'Difficult', value: difficultCount }
    ];

    const levelCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    words.forEach(w => {
      const lvl = w.repetitionLevel || 0;
      if (levelCounts[lvl] !== undefined) {
        levelCounts[lvl]++;
      } else {
        levelCounts[0]++;
      }
    });

    const levelData = [
      { name: '1 Day', count: levelCounts[0] },
      { name: '3 Days', count: levelCounts[1] },
      { name: '7 Days', count: levelCounts[2] },
      { name: '14 Days', count: levelCounts[3] }
    ];

    return { totalWords, difficultCount, languageData, difficultyData, levelData };
  }, [words, difficultWords]);

  const COLORS = ['#4ade80', '#c9a86c', '#2563eb', '#9333ea'];

  if (words.length === 0) {
    return null; // Don't show if no words
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-4 mb-6">
        <span className="font-mono text-xs tracking-[0.25em] text-primary uppercase whitespace-nowrap">Learning Progress</span>
        <div className="h-[1px] w-full bg-white/10"></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 mb-6">
        <div className="bg-base-200/50 p-3 md:p-4 rounded-xl border border-white/5">
          <div className="text-xs sm:text-sm font-sans text-content-muted uppercase mb-1">Total Words</div>
          <div className="text-2xl sm:text-4xl font-bold text-primary">{stats.totalWords}</div>
        </div>
        <div className="bg-base-200/50 p-3 md:p-4 rounded-xl border border-white/5">
          <div className="text-xs sm:text-sm font-sans text-content-muted uppercase mb-1">Difficult Words</div>
          <div className="text-2xl sm:text-4xl font-bold text-secondary">{stats.difficultCount}</div>
        </div>
        <div className="bg-base-200/50 p-3 md:p-4 rounded-xl border border-white/5 col-span-2 lg:col-span-1 flex flex-row items-center justify-between lg:flex-col lg:items-start lg:justify-start">
          <div className="text-xs sm:text-sm font-sans text-content-muted uppercase mb-0 lg:mb-1">Last Practice</div>
          <div className="text-right lg:text-left">
            <div className="text-base sm:text-xl font-bold text-content mt-0 lg:mt-2">
              {lastPractice ? new Date(lastPractice.lastPracticeDate).toLocaleDateString() : 'Never'}
            </div>
            <div className="text-[10px] sm:text-xs text-content-muted mt-0.5 lg:mt-1">
              {lastPractice ? lastPractice.lastExerciseType : '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Language Distribution Chart */}
        <div className="h-48 sm:h-56 lg:h-64">
          <h3 className="text-sm font-mono text-content-muted uppercase mb-2 lg:mb-4 text-center">Words by Language</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.languageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#a0a0a0" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#a0a0a0" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#4ade80' }}
              />
              <Bar dataKey="count" fill="#4ade80" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SRA Level Distribution Chart */}
        <div className="h-48 sm:h-56 lg:h-64">
          <h3 className="text-sm font-mono text-content-muted uppercase mb-2 lg:mb-4 text-center">Spaced Repetition</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.levelData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#a0a0a0" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#a0a0a0" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#2563eb' }}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Difficulty Distribution Chart */}
        <div className="h-48 sm:h-56 lg:h-64 col-span-1 md:col-span-2 lg:col-span-1">
          <h3 className="text-sm font-mono text-content-muted uppercase mb-2 lg:mb-4 text-center">Mastery Level</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.difficultyData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {stats.difficultyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#4ade80' : '#c9a86c'} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#ffffff' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a0a0a0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};

export default ProgressOverview;
