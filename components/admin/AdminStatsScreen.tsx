import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import TeacherDashboardActivity from './TeacherDashboardActivity';
import { User } from '../../types';

const AdminStatsScreen: React.FC = () => {
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (User & { id: string })[];
        setUsers(fetched);
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-content-muted">Ładowanie statystyk...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 p-4">
      <h1 className="text-2xl font-bold">Statystyki Kursantów</h1>
      <TeacherDashboardActivity users={users} />
    </div>
  );
};

export default AdminStatsScreen;
