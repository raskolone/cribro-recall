import React, { useState, useEffect } from 'react';
import TeacherDashboardActivity from './TeacherDashboardActivity';
import { User } from '../../types';
import { getAllUsers, UserWithId } from '../../services/userService';

const AdminStatsScreen: React.FC = () => {
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetched = await getAllUsers();
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
