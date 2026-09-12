import React, { useState } from 'react';
import { Clock, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import SectionHeader from '../ui/SectionHeader';
import { sectionMeta } from '../../utils/sectionMeta';
import StudentLessonPanel from './StudentLessonPanel';
import PracticeSessionsSection from './PracticeSessionsSection';

/**
 * „Historia lekcji" — ekran przejściowy.
 *
 * Wszystko, co tu jest, stoi już w panelu kursanta („Mój panel"): historia
 * lekcji po miesiącach i własne sesje ćwiczeń. Zakładka zostaje do czasu, aż
 * kursanci przyzwyczają się do nowego wejścia, i wtedy znika. Dlatego nie ma
 * tu własnych widoków — te same komponenty, tylko rozdzielone na dwie zakładki.
 */

interface LessonHistoryScreenProps {
  /** Podgląd historii konkretnego kursanta (lektor). Domyślnie własne konto. */
  studentId?: string;
  onStudySet?: (setId: string) => void;
  onNavigate?: (view: string, extra?: any) => void;
}

const LessonHistoryScreen: React.FC<LessonHistoryScreenProps> = ({ studentId, onStudySet, onNavigate }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'lessons' | 'sessions'>('lessons');
  const targetId = studentId || user?.id || '';

  const tabClass = (tab: 'lessons' | 'sessions') =>
    `px-4 min-h-[2.75rem] rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
      activeTab === tab
        ? 'bg-primary/12 text-primary border border-primary/30 shadow-glow'
        : 'text-content-muted hover:text-text-hi'
    }`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 pb-24">
      <SectionHeader
        className="mb-6"
        divider={false}
        title={sectionMeta('lesson-history', language)?.title}
        subtitle={sectionMeta('lesson-history', language)?.subtitle}
        actions={
          <div className="flex liquid-glass-tile p-1 rounded-xl border border-white/10">
            <button onClick={() => setActiveTab('lessons')} className={tabClass('lessons')}>
              <FileText className="w-4 h-4" />
              {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
            </button>
            <button onClick={() => setActiveTab('sessions')} className={tabClass('sessions')}>
              <Clock className="w-4 h-4" />
              {language === 'pl' ? 'Historia sesji' : 'Session History'}
            </button>
          </div>
        }
      />

      <div className="max-w-2xl mx-auto">
        {activeTab === 'lessons' ? (
          <StudentLessonPanel
            studentId={targetId}
            variant="history"
            onStudySet={onStudySet}
            onPracticeAI={(setId) => onNavigate && onNavigate('ai-generator', { setId })}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-base-200/40 overflow-hidden">
            <PracticeSessionsSection studentId={targetId} asSection={false} />
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonHistoryScreen;
