import React, { useState, useEffect } from 'react';
import { FileText, Loader2, AlertCircle, Share2, Copy, Check, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ScratchpadDocument } from '../../types';
import {
  getOrCreateStudentScratchpad,
  subscribeScratchpad,
  saveScratchpadContent,
  buildScratchpadUrl,
} from '../../services/scratchpadService';
import { formatAccessCode } from '../../utils/accessCode';
import ScratchpadEditor from './ScratchpadEditor';
import Button from '../ui/Button';

export const StudentScratchpadScreen: React.FC = () => {
  const { user } = useAuth();
  const [document, setDocument] = useState<ScratchpadDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const studentName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.username || 'Kursant';

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    const load = async () => {
      try {
        const doc = await getOrCreateStudentScratchpad(
          { id: user.id, name: studentName },
          { uid: 'teacher_default', name: 'Lektor CRIBRO' }
        );
        if (isMounted) {
          setDocument(doc);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Błąd ładowania brudnopisu kursanta:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Nie udało się otworzyć notatnika.');
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [user?.id, studentName]);

  // Subskrypcja Firestore na żywo
  useEffect(() => {
    if (!document?.id) return;

    const unsubscribe = subscribeScratchpad(document.id, (updated) => {
      if (updated) {
        setDocument(updated);
      }
    });

    return () => unsubscribe();
  }, [document?.id]);

  const handleSaveContent = async (html: string, text: string) => {
    if (!document?.id || !user) return;
    return await saveScratchpadContent(document.id, html, text, {
      uid: user.id,
      name: studentName,
      role: 'student',
    });
  };

  const handleCopyLink = () => {
    if (!document) return;
    const url = buildScratchpadUrl(document.id);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4 min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-content-muted">Ładowanie Twojego notatnika lekcyjnego...</p>
      </div>
    );
  }

  if (errorMessage || !document) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh]">
        <div className="p-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 max-w-md text-center space-y-3">
          <AlertCircle size={32} className="mx-auto" />
          <h3 className="font-bold text-base">Nie udało się otworzyć notatnika</h3>
          <p className="text-xs opacity-80">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-2 sm:p-4 md:p-6 max-w-7xl mx-auto w-full animate-fadeIn min-h-[720px]">
      <ScratchpadEditor
        document={document}
        onSaveContent={document.allowStudentEdit ? handleSaveContent : undefined}
        currentUser={{
          uid: user?.id || 'student',
          name: studentName,
          role: 'student',
        }}
        className="h-full flex-1 rounded-2xl border border-line-strong overflow-hidden shadow-[var(--shadow-lg)]"
      />
    </div>
  );
};

export default StudentScratchpadScreen;
