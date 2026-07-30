import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, PracticeLog } from '../../types';
import { Activity, Clock, BookOpen, LogIn, Search, ChevronDown, ChevronUp, BarChart2, ListFilter, Users } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import i18n from "i18next";

interface ActivityProps {
  users: (User & { id: string })[];
}

interface CombinedActivity {
  id: string;
  type: 'login' | 'practice' | 'test';
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  timestamp: Date;
  dateStr: string;
  title: string;
  details?: string;
  score?: string;
}

const TeacherDashboardActivity: React.FC<ActivityProps> = ({ users }) => {
  const [activities, setActivities] = useState<CombinedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'login' | 'practice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeViewMode, setActiveViewMode] = useState<'both' | 'chart' | 'logs'>('both');

  useEffect(() => {
    const fetchAllActivities = async () => {
      setIsLoading(true);
      try {
        const allActs: CombinedActivity[] = [];

        // 1. Logins from user profiles
        users.forEach(u => {
          const userName = u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username;
          if (u.lastLoginDate) {
            const loginDate = new Date(u.lastLoginDate);
            if (!isNaN(loginDate.getTime())) {
              allActs.push({
                id: `login-${u.id}-${loginDate.getTime()}`,
                type: 'login',
                userId: u.id,
                userName,
                userEmail: u.email || u.username,
                photoURL: u.photoURL,
                timestamp: loginDate,
                dateStr: loginDate.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' }),
                title: 'Zalogowanie do aplikacji',
                details: `Łącznie logowań: ${u.loginCount || 1}`
              });
            }
          }
        });

        // 2. Practice logs per student
        await Promise.all(
          users.map(async (u) => {
            try {
              const userName = u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username;
              const logsRef = collection(db, `users/${u.id}/practiceLogs`);
              const snap = await getDocs(logsRef);
              snap.docs.forEach(docSnap => {
                const data = docSnap.data() as PracticeLog;
                if (data.date) {
                  const logDate = new Date(data.date);
                  if (!isNaN(logDate.getTime())) {
                    const isTest = (data.exerciseType as string) === 'test' || Boolean(data.testName);
                    const scoreText = data.score !== undefined && data.totalWords
                      ? `${data.score}/${data.totalWords}`
                      : (data.score !== undefined ? `${data.score}%` : undefined);

                    allActs.push({
                      id: `log-${u.id}-${docSnap.id}`,
                      type: isTest ? 'test' : 'practice',
                      userId: u.id,
                      userName,
                      userEmail: u.email || u.username,
                      photoURL: u.photoURL,
                      timestamp: logDate,
                      dateStr: logDate.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' }),
                      title: data.testName ? `Test: ${data.testName}` : `Ćwiczenie: ${data.exerciseType || 'Trening słówek'}`,
                      details: data.isRevisionMode ? 'Tryb powtórki' : undefined,
                      score: scoreText
                    });
                  }
                }
              });
            } catch (err) {
              console.error(`Error loading logs for user ${u.id}:`, err);
            }
          })
        );

        allActs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(allActs);
      } catch (err) {
        console.error('Error fetching activity log:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (users && users.length > 0) {
      fetchAllActivities();
    } else {
      setIsLoading(false);
    }
  }, [users]);

  // Aggregate activity for chart (last 10 days)
  const chartData = useMemo(() => {
    const daysMap: Record<string, { dateStr: string; logins: number; exercises: number; total: number }> = {};
    const now = new Date();

    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
      daysMap[iso] = { dateStr: label, logins: 0, exercises: 0, total: 0 };
    }

    activities.forEach(act => {
      const actIso = act.timestamp.toISOString().split('T')[0];
      if (daysMap[actIso]) {
        if (act.type === 'login') {
          daysMap[actIso].logins += 1;
        } else {
          daysMap[actIso].exercises += 1;
        }
        daysMap[actIso].total += 1;
      }
    });

    return Object.values(daysMap);
  }, [activities]);

  const filteredActivities = activities.filter(a => {
    const matchesSearch = a.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' 
      ? true 
      : typeFilter === 'login' 
        ? a.type === 'login' 
        : (a.type === 'practice' || a.type === 'test');
    return matchesSearch && matchesType;
  });

  const totalLogins = activities.filter(a => a.type === 'login').length;
  const totalExercises = activities.filter(a => a.type !== 'login').length;
  const uniqueUsersActive = new Set(activities.map(a => a.userId)).size;

  return (
    <div className="bg-gradient-to-r from-base-200/90 via-base-200/60 to-base-200/90 backdrop-blur-xl rounded-2xl border border-primary/30 p-5 shadow-2xl relative overflow-hidden my-4 transition-all duration-300">
      <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header Box & Toggle Button */}
      <div 
        className="flex items-center justify-between gap-4 cursor-pointer select-none group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center border border-primary/40 shadow-lg group-hover:scale-105 transition-transform flex-shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                {i18n.t("Ogólne statystyki kursantów")}
              </h2>
              <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                {isExpanded ? i18n.t("Otwarte") : i18n.t("Kliknij, aby rozwinąć")}
              </span>
            </div>
            <p className="text-xs text-content-muted mt-0.5">
              {i18n.t("Wykres aktywności, logowania i pełna historia prób ćwiczeń w czasie")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono">
            <div className="bg-base-100/70 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-inner">
              <LogIn size={13} className="text-blue-400" />
              <span>Logowań: <strong className="text-white">{totalLogins}</strong></span>
            </div>
            <div className="bg-base-100/70 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-inner">
              <BookOpen size={13} className="text-emerald-400" />
              <span>Ćwiczeń: <strong className="text-white">{totalExercises}</strong></span>
            </div>
            <div className="bg-base-100/70 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-inner">
              <Users size={13} className="text-purple-400" />
              <span>Aktywnych: <strong className="text-white">{uniqueUsersActive}</strong></span>
            </div>
          </div>

          <button 
            type="button" 
            className="p-2 rounded-xl bg-base-100/80 hover:bg-primary/20 text-content-muted hover:text-primary border border-white/10 transition-all shadow-md"
            aria-label="Toggle statistics"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-5 pt-4 border-t border-white/10 space-y-5 animate-in fade-in duration-300">
          
          {/* Sub-header controls: View Mode & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-100/40 p-2.5 rounded-xl border border-white/5">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-base-100/80 p-1 rounded-lg border border-white/10 w-full sm:w-auto">
              <button
                onClick={() => setActiveViewMode('both')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeViewMode === 'both' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:text-white'
                }`}
              >
                <BarChart2 size={13} />
                <span>Wykres + Logi</span>
              </button>
              <button
                onClick={() => setActiveViewMode('chart')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeViewMode === 'chart' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:text-white'
                }`}
              >
                <BarChart2 size={13} />
                <span>Sam wykres</span>
              </button>
              <button
                onClick={() => setActiveViewMode('logs')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeViewMode === 'logs' ? 'bg-primary text-black shadow-md' : 'text-content-muted hover:text-white'
                }`}
              >
                <ListFilter size={13} />
                <span>Samo logi</span>
              </button>
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-base-100/60 text-content-muted hover:text-white'
                }`}
              >
                {i18n.t("Wszystkie")}
              </button>
              <button
                onClick={() => setTypeFilter('login')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === 'login' ? 'bg-blue-500/80 text-white' : 'bg-base-100/60 text-content-muted hover:text-white'
                }`}
              >
                {i18n.t("Logowania")}
              </button>
              <button
                onClick={() => setTypeFilter('practice')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === 'practice' ? 'bg-emerald-500/80 text-white' : 'bg-base-100/60 text-content-muted hover:text-white'
                }`}
              >
                {i18n.t("Ćwiczenia")}
              </button>
            </div>
          </div>

          {/* Graphical Activity Chart */}
          {(activeViewMode === 'both' || activeViewMode === 'chart') && (
            <div className="bg-base-100/50 p-4 rounded-xl border border-white/5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 size={15} className="text-primary" />
                  {i18n.t("Wykres aktywności w ostatnich 10 dniach")}
                </h3>
                <div className="flex items-center gap-4 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    Ćwiczenia
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                    Logowania
                  </span>
                </div>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorExercises" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="dateStr" tick={{ fill: '#888', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#888', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                    />
                    <Area type="monotone" dataKey="exercises" stroke="#10b981" fillOpacity={1} fill="url(#colorExercises)" name="Ćwiczenia" />
                    <Area type="monotone" dataKey="logins" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLogins)" name="Logowania" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Activity Search & Detailed Logs */}
          {(activeViewMode === 'both' || activeViewMode === 'logs') && (
            <div className="space-y-3">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder={i18n.t("Szukaj w logach (imię, słowo kluczowe)...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-base-100/80 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-content-muted focus:border-primary/50 outline-none transition-colors"
                />
              </div>

              {isLoading ? (
                <div className="text-center py-6 text-xs text-content-muted font-mono">
                  {i18n.t("Wczytywanie logów aktywności...")}
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-6 text-xs text-content-muted border border-dashed border-white/10 rounded-xl">
                  {i18n.t("Brak aktywności spełniających kryteria.")}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredActivities.slice(0, 50).map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between bg-base-100/40 hover:bg-base-100/80 p-2.5 px-3 rounded-xl border border-white/5 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-base-300 flex items-center justify-center font-bold text-primary flex-shrink-0 text-[11px] border border-white/10 overflow-hidden">
                          {act.photoURL ? (
                            <img src={act.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            act.userName[0]?.toUpperCase() || 'U'
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-white truncate">{act.userName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              act.type === 'login' 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : act.type === 'test' 
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {act.type === 'login' ? 'Logowanie' : act.type === 'test' ? 'Test' : 'Ćwiczenie'}
                            </span>
                          </div>
                          <div className="text-content-muted text-[11px] truncate mt-0.5">
                            {act.title} {act.details ? `(${act.details})` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                        {act.score && (
                          <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                            {act.score}
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-content-muted font-mono text-[11px]">
                          <Clock size={11} />
                          <span>{act.dateStr}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardActivity;


