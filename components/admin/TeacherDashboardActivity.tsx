import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from '../../types';
import { Activity, Clock } from 'lucide-react';
import Card from '../ui/Card';

interface ActivityProps {
  users: (User & { id: string })[];
}

const TeacherDashboardActivity: React.FC<ActivityProps> = ({ users }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentLogins, setRecentLogins] = useState<(User & { id: string })[]>([]);

  useEffect(() => {
    // Sort users by lastLoginDate locally since we already have the users array
    const sorted = [...users]
      .filter(u => u.lastLoginDate)
      .sort((a, b) => new Date(b.lastLoginDate!).getTime() - new Date(a.lastLoginDate!).getTime())
      .slice(0, 10);
    setRecentLogins(sorted);
  }, [users]);

  return (
    <div className="bg-base-200/50 rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between p-6 hover:bg-base-200 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Activity size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg">Ostatnia aktywność kursantów</h3>
            <p className="text-sm text-content-muted">Zobacz kto ostatnio się logował i ćwiczył</p>
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
          {recentLogins.length === 0 ? (
            <p className="text-center text-content-muted py-8">Brak ostatniej aktywności.</p>
          ) : (
            <div className="space-y-4">
              {recentLogins.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-base-200 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center font-bold text-primary flex-shrink-0">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        u.firstName ? u.firstName[0].toUpperCase() : u.username[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold">{u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}</div>
                      <div className="text-xs text-content-muted">{u.email || u.username}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-sm">
                    <div className="flex items-center gap-1 text-content-muted">
                      <Clock size={14} />
                      <span>{new Date(u.lastLoginDate!).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-primary font-bold mt-1">Logowania: {u.loginCount || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardActivity;
