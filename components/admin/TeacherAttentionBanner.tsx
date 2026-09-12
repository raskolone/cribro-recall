import React, { useEffect, useState } from 'react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertTriangle, ChevronRight } from 'lucide-react';

/**
 * Sygnał "wymaga uwagi", nie kolejny ekran (docs/kolejka-przebudowa-panelu.md,
 * pkt 1). Renderuje się raz, u góry powłoki panelu lektora (`AdminPanel.tsx`),
 * więc zostaje widoczny także w karcie kursanta, prezentacji itd. — panel nie
 * odmontowuje się między tymi widokami, tylko przełącza treść wewnątrz siebie.
 *
 * Znika całkowicie, gdy nie ma nic do zrobienia — zero pustego paska.
 */

interface TeacherAttentionBannerProps {
  /** `filterStatus` — ten sam sentinel, który już rozumie HomeworkScreen. */
  onOpenHomework: (filterStatus: 'submitted' | 'v2review') => void;
}

export const TeacherAttentionBanner: React.FC<TeacherAttentionBannerProps> = ({ onOpenHomework }) => {
  const [submittedCount, setSubmittedCount] = useState(0);
  const [flaggedV2Count, setFlaggedV2Count] = useState(0);

  useEffect(() => {
    const qSubmitted = query(collection(db, 'specialTasks'), where('status', '==', 'submitted'));
    const unsub = onSnapshot(
      qSubmitted,
      (snap) => setSubmittedCount(snap.size),
      (err) => console.warn('TeacherAttentionBanner submitted snapshot error:', err)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const qFlagged = query(collectionGroup(db, 'attempts'), where('requiresTeacherReview', '==', true));
    const unsub = onSnapshot(
      qFlagged,
      (snap) => setFlaggedV2Count(snap.size),
      (err) => console.warn('TeacherAttentionBanner flagged v2 snapshot error:', err)
    );
    return unsub;
  }, []);

  if (submittedCount === 0 && flaggedV2Count === 0) return null;

  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex items-center gap-2 text-warn font-bold text-sm shrink-0">
        <AlertTriangle size={18} />
        Wymaga Twojej uwagi
      </div>
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {submittedCount > 0 && (
          <button
            onClick={() => onOpenHomework('submitted')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-warn/15 border border-warn/30 text-text-hi hover:bg-warn/25 transition-colors"
          >
            {submittedCount} {submittedCount === 1 ? 'praca odesłana' : 'prac odesłanych'} do oceny
            <ChevronRight size={14} />
          </button>
        )}
        {flaggedV2Count > 0 && (
          <button
            onClick={() => onOpenHomework('v2review')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-warn/15 border border-warn/30 text-text-hi hover:bg-warn/25 transition-colors"
          >
            {flaggedV2Count} {flaggedV2Count === 1 ? 'próba (v2)' : 'prób (v2)'} wymaga przeglądu
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TeacherAttentionBanner;
