import React, { useState, useEffect } from 'react';
import { User, PracticeLog } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

interface StatsProps {
  users: (User & { id: string })[];
}

const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#8884d8'];

const TeacherDashboardStats: React.FC<StatsProps> = ({ users }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<PracticeLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Overall Stats
  const loginStats = users
    .map(u => ({
      name: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username,
      logins: u.loginCount || 0
    }))
    .sort((a, b) => b.logins - a.logins)
    .slice(0, 10);

  const levelStats = users.reduce((acc, user) => {
    const lvl = user.level || 'Brak';
    acc[lvl] = (acc[lvl] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const levelPieData = Object.keys(levelStats).map(key => ({
    name: key,
    value: levelStats[key]
  }));

  useEffect(() => {
    if (selectedUserId) {
      const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
          const logsQ = query(collection(db, `users/${selectedUserId}/practiceLogs`));
          const snap = await getDocs(logsQ);
          const logs = snap.docs.map(d => d.data() as PracticeLog);
          setUserLogs(logs);
        } catch(e) {
          console.error(e);
        } finally {
          setIsLoadingLogs(false);
        }
      };
      fetchLogs();
    } else {
      setUserLogs([]);
    }
  }, [selectedUserId]);

  const selectedUser = users.find(u => u.id === selectedUserId);

  // Process logs for the selected user
  const userPerformanceData = userLogs.map(log => {
    const total = log.totalWords || 0;
    const correct = log.score || 0;
    const errors = total - correct > 0 ? total - correct : 0;
    return {
      date: new Date(log.date).toLocaleDateString(),
      poprawne: correct,
      błędy: errors,
      razem: total
    };
  }).slice(-10); // last 10 sessions

  return (
    <div className="bg-base-200/50 rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between p-6 hover:bg-base-200 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
            <BarChart3 size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg">Statystyki graficzne</h3>
            <p className="text-sm text-content-muted">Analizuj postępy i zaangażowanie</p>
          </div>
        </div>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-6 w-6 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-6 border-t border-white/5 bg-base-100/50">
          <div className="mb-6 flex items-center justify-between">
            <select 
              className="bg-base-300 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-primary/50"
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
            >
              <option value="">Wszyscy kursanci (Ogólne statystyki)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                </option>
              ))}
            </select>
          </div>

          {!selectedUserId ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-4 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5">
                <h4 className="font-bold text-center mb-4">Top 10: Najczęstsze logowania</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={loginStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" tick={{fill: '#888'}} />
                      <YAxis tick={{fill: '#888'}} />
                      <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px'}} />
                      <Bar dataKey="logins" fill="#00C49F" radius={[4, 4, 0, 0]} name="Logowania" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="p-4 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5">
                <h4 className="font-bold text-center mb-4">Poziomy zaawansowania</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={levelPieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {levelPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5">
              <h4 className="font-bold text-lg mb-6">
                Postępy w ćwiczeniach (Ostatnie sesje): {selectedUser?.firstName || selectedUser?.username}
              </h4>
              {isLoadingLogs ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : userLogs.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-content-muted">
                  Brak historii ćwiczeń dla tego kursanta.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" tick={{fill: '#888'}} />
                      <YAxis tick={{fill: '#888'}} />
                      <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px'}} />
                      <Legend />
                      <Bar dataKey="poprawne" stackId="a" fill="#00C49F" name="Poprawne odpowiedzi" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="błędy" stackId="a" fill="#ef4444" name="Błędy" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardStats;
