import React, { useState } from 'react';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface AssignedTasksProps {
  onStudySet: (setId: string) => void;
}

const AssignedTasks: React.FC<AssignedTasksProps> = ({ onStudySet }) => {
  const { sets } = useFlashcards();
  const { language } = useLanguage();
  
  const [checkedSets, setCheckedSets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('checked_sets') || '[]');
    } catch {
      return [];
    }
  });

  const handleCheckSet = (setId: string) => {
    if (!checkedSets.includes(setId)) {
      const updated = [...checkedSets, setId];
      setCheckedSets(updated);
      localStorage.setItem('checked_sets', JSON.stringify(updated));
    }
  };

  const isRecent = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const diffDays = Math.ceil(Math.abs(Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  const assignedSets = sets.filter(s => s.assignedByTeacher).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (assignedSets.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        {language === 'pl' ? 'Moje zadania domowe' : 'My Homework'}
        {assignedSets.some(s => isRecent(s.createdAt) && !checkedSets.includes(s.id)) && (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
          </span>
        )}
      </h2>
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {assignedSets.map(set => {
          const recentAndUnchecked = isRecent(set.createdAt) && !checkedSets.includes(set.id);
          
          return (
            <div 
              key={set.id} 
              className={`p-4 rounded-xl border relative overflow-hidden group transition-colors ${
                recentAndUnchecked 
                  ? 'bg-base-200 border-primary/40 shadow-[0_0_15px_rgba(114,240,180,0.1)]' 
                  : 'bg-base-200/50 border-white/5 hover:border-primary/30'
              }`}
            >
              {recentAndUnchecked && (
                <div className="absolute top-0 right-0 px-2 py-1 bg-secondary text-secondary-content text-[10px] font-bold uppercase rounded-bl-lg z-10 animate-pulse">
                  {language === 'pl' ? 'Nowe' : 'New'}
                </div>
              )}
              
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className={`font-bold pr-12 ${recentAndUnchecked ? 'text-primary' : 'text-white group-hover:text-primary transition-colors'}`}>
                    {set.title}
                  </h4>
                  {set.lessonTopic && (
                    <p className="text-xs text-content-muted mt-1">
                      {language === 'pl' ? 'Temat lekcji: ' : 'Lesson topic: '}{set.lessonTopic}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-mono text-content-muted">
                  {set.cardCount} {language === 'pl' ? 'słówek' : 'words'}
                </span>
                
                <Button 
                  onClick={() => {
                    handleCheckSet(set.id);
                    onStudySet(set.id);
                  }} 
                  size="sm" 
                  variant={recentAndUnchecked ? 'primary' : 'secondary'}
                >
                  {language === 'pl' ? 'Ucz się' : 'Study'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default AssignedTasks;
