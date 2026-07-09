import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useVocabulary } from '../../context/VocabularyContext';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../ui/Card';

const LearningProgressChart: React.FC = () => {
  const { words } = useVocabulary();
  const { language } = useLanguage();

  const data = useMemo(() => {
    if (!words || words.length === 0) return [];

    // Extract dates from word IDs: "word-1678901234567-xxxx"
    const wordsWithDate = words.map(w => {
      let timestamp = Date.now();
      if (w.id.startsWith('word-')) {
        const parts = w.id.split('-');
        if (parts.length >= 2) {
          const parsed = parseInt(parts[1], 10);
          if (!isNaN(parsed) && parsed > 1600000000000) {
            timestamp = parsed;
          }
        }
      }
      return { ...w, timestamp };
    }).sort((a, b) => a.timestamp - b.timestamp);

    // Group by day (YYYY-MM-DD)
    const grouped = wordsWithDate.reduce((acc, word) => {
      const date = new Date(word.timestamp).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // If there's no data, return empty
    if (Object.keys(grouped).length === 0) return [];

    const sortedDates = Object.keys(grouped).sort();
    
    // Create cumulative data
    let cumulative = 0;
    const chartData = sortedDates.map(date => {
      cumulative += grouped[date];
      return {
        date,
        count: cumulative
      };
    });

    // Ensure we have at least 7 days of data by padding the front if needed
    // or just display what we have. It's better to show the progression nicely.
    if (chartData.length === 1) {
       // Just one data point, let's pad it so it looks like a chart
       const theDate = new Date(chartData[0].date);
       const prevDate = new Date(theDate);
       prevDate.setDate(prevDate.getDate() - 1);
       chartData.unshift({
           date: prevDate.toISOString().split('T')[0],
           count: 0
       });
    }

    return chartData;
  }, [words]);

  if (data.length === 0) {
    return null; // Don't render anything if no words
  }

  const title = language === 'pl' ? 'Postęp w nauce (Słownictwo)' : 'Learning Progress (Vocabulary)';

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-6">{title}</h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#72f0b4" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#72f0b4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
                dataKey="date" 
                stroke="#7a8da6" 
                tick={{fill: '#7a8da6', fontSize: 12}}
                tickFormatter={(val) => {
                    // format as MM-DD
                    const parts = val.split('-');
                    if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
                    return val;
                }}
            />
            <YAxis 
                stroke="#7a8da6" 
                tick={{fill: '#7a8da6', fontSize: 12}} 
            />
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <Tooltip 
                contentStyle={{ backgroundColor: '#141b2a', borderColor: 'rgba(255,255,255,0.1)', color: '#eae8e3' }}
                itemStyle={{ color: '#72f0b4', fontWeight: 'bold' }}
                labelStyle={{ color: '#7a8da6', marginBottom: '4px' }}
                formatter={(value: number) => [value, language === 'pl' ? 'Słówka' : 'Words']}
                labelFormatter={(label) => label}
            />
            <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#72f0b4" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorCount)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default LearningProgressChart;
