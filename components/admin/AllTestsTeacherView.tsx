import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudentTest, User } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TestPreviewModal from './TestPreviewModal';
import TestEditModal from './TestEditModal';
import { Eye, Edit2, Trash2, Search, Filter, Bell, CheckCircle2, Clock, Calendar, Award, User as UserIcon } from 'lucide-react';
import i18n from 'i18next';

export const AllTestsTeacherView: React.FC = () => {
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Modals state
  const [previewTest, setPreviewTest] = useState<StudentTest | null>(null);
  const [editTest, setEditTest] = useState<StudentTest | null>(null);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all users to map names and emails
      const usersSnap = await getDocs(collection(db, 'users'));
      const map: Record<string, User> = {};
      const usersList: User[] = [];
      usersSnap.docs.forEach(d => {
        const u = { id: d.id, ...d.data() } as User;
        map[d.id] = u;
        usersList.push(u);
      });
      setUsersMap(map);

      // 2. Fetch tests across all users
      const allTests: StudentTest[] = [];
      for (const u of usersList) {
        if (!u.id) continue;
        const testsSnap = await getDocs(collection(db, `users/${u.id}/tests`));
        testsSnap.docs.forEach(d => {
          const testData = d.data();
          allTests.push({
            id: d.id,
            studentId: u.id,
            studentName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
            studentEmail: u.email,
            ...testData
          } as StudentTest);
        });
      }

      // Sort by createdAt descending
      allTests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTests(allTests);
    } catch (err) {
      console.error("Error fetching all tests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleDeleteTest = async (test: StudentTest) => {
    if (!test.id || !test.studentId) return;
    if (!window.confirm(i18n.t("Czy na pewno chcesz usunąć ten przypisany test? Kursant nie będzie go już widział."))) return;

    try {
      await deleteDoc(doc(db, `users/${test.studentId}/tests`, test.id));
      setTests(prev => prev.filter(t => t.id !== test.id));
    } catch (err) {
      console.error(err);
      alert(i18n.t("Błąd podczas usuwania testu"));
    }
  };

  const handleOpenPreview = async (test: StudentTest) => {
    setPreviewTest(test);
    
    // If completed and unread, mark read in Firestore
    if (test.teacherRead === false && test.studentId && test.id) {
      try {
        await updateDoc(doc(db, `users/${test.studentId}/tests`, test.id), {
          teacherRead: true
        });
        setTests(prev => prev.map(t => t.id === test.id ? { ...t, teacherRead: true } : t));
      } catch (err) {
        console.error("Error updating teacherRead:", err);
      }
    }
  };

  const handleOpenEdit = async (test: StudentTest) => {
    setEditTest(test);

    // If completed and unread, mark read in Firestore
    if (test.teacherRead === false && test.studentId && test.id) {
      try {
        await updateDoc(doc(db, `users/${test.studentId}/tests`, test.id), {
          teacherRead: true
        });
        setTests(prev => prev.map(t => t.id === test.id ? { ...t, teacherRead: true } : t));
      } catch (err) {
        console.error("Error updating teacherRead:", err);
      }
    }
  };

  // Filtered tests
  const filteredTests = tests.filter(test => {
    const studentStr = `${test.studentName || ''} ${test.studentEmail || ''} ${test.title || ''}`.toLowerCase();
    const matchesSearch = studentStr.includes(searchQuery.toLowerCase());
    
    const isCompleted = test.status === 'completed' || test.status === 'graded';
    const matchesStatus = statusFilter === 'all' 
      || (statusFilter === 'pending' && test.status === 'pending')
      || (statusFilter === 'completed' && isCompleted);

    return matchesSearch && matchesStatus;
  });

  const unreadCount = tests.filter(t => (t.status === 'completed' || t.status === 'graded') && t.teacherRead === false).length;

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{i18n.t("Wszystkie Przypisane Testy")}</h1>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full text-xs font-bold animate-pulse">
                <Bell size={14} className="animate-bounce" />
                {unreadCount} {i18n.t("nowo rozwiązanych")}
              </div>
            )}
          </div>
          <p className="text-content-muted text-sm mt-1">
            {i18n.t("Przegląd, edycja i ocena testów przypisanych do wszystkich kursantów.")}
          </p>
        </div>

        <Button onClick={fetchAllData} isLoading={isLoading} variant="secondary" size="sm">
          {i18n.t("Odśwież listę")}
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-base-200/50 border border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            type="text"
            placeholder={i18n.t("Szukaj po nazwie testu, imieniu lub emailu kursanta...")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-base-100 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-primary/50 text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-content-muted shrink-0" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-base-100 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 cursor-pointer w-full sm:w-auto"
          >
            <option value="all">{i18n.t("Wszystkie statusy")}</option>
            <option value="pending">{i18n.t("Oczekujące")}</option>
            <option value="completed">{i18n.t("Rozwiązane / Ocenione")}</option>
          </select>
        </div>
      </Card>

      {/* Test List */}
      {isLoading ? (
        <div className="text-center py-12 text-content-muted flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
          {i18n.t("Ładowanie testów...")}
        </div>
      ) : filteredTests.length === 0 ? (
        <Card className="p-8 text-center text-content-muted bg-base-200/30">
          {i18n.t("Brak przypisanych testów spełniających kryteria.")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTests.map(test => {
            const isDone = test.status === 'completed' || test.status === 'graded';
            const isUnread = isDone && test.teacherRead === false;

            return (
              <Card
                key={`${test.studentId}-${test.id}`}
                className={`p-4 transition-all border ${
                  isUnread
                    ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse'
                    : 'bg-base-200/40 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info Column */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg text-white truncate">{test.title}</span>
                      
                      {isUnread && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-bounce flex items-center gap-1">
                          <Bell size={12} /> Nowy wynik!
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        test.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-primary/20 text-primary border border-primary/30'
                      }`}>
                        {test.status === 'pending' ? 'Oczekujący' : 'Ukończony'}
                      </span>

                      {isDone && test.score !== undefined && test.maxScore !== undefined && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <Award size={12} /> {test.score}/{test.maxScore} pts
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-content-muted flex-wrap">
                      <span className="flex items-center gap-1 text-primary/90 font-medium">
                        <UserIcon size={14} /> {test.studentName} {test.studentEmail ? `(${test.studentEmail})` : ''}
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> Termin: <strong className="text-white">{test.dueDate}</strong>
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock size={14} /> Przypisany: {new Date(test.createdAt).toLocaleDateString()}
                      </span>

                      {test.completedAt && (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 size={14} /> Rozwiązany: {new Date(test.completedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <Button
                      onClick={() => handleOpenPreview(test)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-1.5"
                    >
                      <Eye size={16} />
                      {i18n.t("Podgląd")}
                    </Button>

                    <Button
                      onClick={() => handleOpenEdit(test)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-1.5"
                    >
                      <Edit2 size={16} />
                      {i18n.t("Edycja")}
                    </Button>

                    <button
                      onClick={() => handleDeleteTest(test)}
                      className="p-2 rounded-lg text-content-muted hover:text-red-400 hover:bg-red-400/10 transition-colors border border-transparent hover:border-red-400/20"
                      title={i18n.t("Usuń test")}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <TestPreviewModal
        test={previewTest}
        isOpen={!!previewTest}
        onClose={() => setPreviewTest(null)}
      />

      <TestEditModal
        test={editTest}
        isOpen={!!editTest}
        onClose={() => setEditTest(null)}
        onSaved={fetchAllData}
      />
    </div>
  );
};

export default AllTestsTeacherView;
