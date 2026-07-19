import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { User } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { BarChart2, History, User as UserIcon, ClipboardList, Search } from 'lucide-react';

interface UserWithId extends User {
  id: string;
}

interface TeacherQuickAccessProps {
  onNavigate: (view: string) => void;
  onSelectStudent: (student: UserWithId) => void;
}

const TeacherQuickAccess: React.FC<TeacherQuickAccessProps> = ({ onNavigate, onSelectStudent }) => {
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as UserWithId))
          .filter(user => user.username !== 'Demo User' && user.username !== 'Demo User (Offline)');
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const searchStr = `${u.firstName || ''} ${u.lastName || ''} ${u.username} ${u.username}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold whitespace-nowrap text-primary">Panel nauczyciela</h2>
        <div className="h-px bg-base-300 flex-1"></div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card onClick={() => onNavigate('admin-stats')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors bg-base-200/50">
          <BarChart2 className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">Statystyki</span>
        </Card>
        <Card onClick={() => onNavigate('admin-history')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors bg-base-200/50">
          <History className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">Historia</span>
        </Card>
        <Card onClick={() => onNavigate('admin-profile')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors bg-base-200/50">
          <UserIcon className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">Profil kursanta</span>
        </Card>
        <Card onClick={() => onNavigate('admin-tests')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors bg-base-200/50">
          <ClipboardList className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">Testy</span>
        </Card>
      </div>

      <Card className="bg-base-200/50 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <h3 className="font-bold">Wybierz kursanta</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input 
              type="text" 
              placeholder="Szukaj kursanta..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-base-100 border border-base-300 rounded-lg pl-9 pr-4 py-2 outline-none focus:border-primary/50 text-sm"
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-4 text-content-muted">Ładowanie kursantów...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredUsers.map(u => (
              <div 
                key={u.id}
                onClick={() => onSelectStudent(u)}
                className="bg-base-100 border border-white/5 hover:border-primary/30 p-3 rounded-xl cursor-pointer transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center font-bold text-primary flex-shrink-0">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    u.firstName ? u.firstName[0].toUpperCase() : u.username[0].toUpperCase()
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold truncate text-sm">
                    {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                  </div>
                  <div className="text-xs text-content-muted truncate">{u.username}</div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="col-span-full text-center py-4 text-content-muted">Nie znaleziono kursantów.</div>
            )}
          </div>
        )}
      </Card>


    </div>
  );
};

export default TeacherQuickAccess;
