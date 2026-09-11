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
          setErrorMessage(err.message || 'Nie udało się otworzyć brudnopisu.');
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
    const url = buildScratchpadUrl(document.pin);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4 min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-content-muted">Ładowanie Twojego brudnopisu lekcyjnego...</p>
      </div>
    );
  }

  if (errorMessage || !document) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh]">
        <div className="p-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 max-w-md text-center space-y-3">
          <AlertCircle size={32} className="mx-auto" />
          <h3 className="font-bold text-base">Nie udało się otworzyć brudnopisu</h3>
          <p className="text-xs opacity-80">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Nagłówek sekcji */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
            <FileText size={15} />
            <span>Współdzielony Brudnopis Lekcyjny</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Mój Brudnopis z Lektorem
          </h1>
          <p className="text-content-muted text-xs sm:text-sm mt-1">
            Jeden stały dokument, w którym lektor notuje nowe słownictwo, poprawki gramatyczne i ustalenia.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-base-200 px-3 py-1.5 rounded-xl border border-white/10 text-xs gap-2">
            <span className="text-content-muted text-[10px] uppercase font-mono">Twój stały PIN:</span>
            <span className="font-mono font-bold text-primary tracking-widest text-sm">
              {formatAccessCode(document.pin)}
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs flex items-center gap-1.5"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span>{copiedLink ? 'Skopiowano link!' : 'Kopiuj link na telefon'}</span>
          </Button>
        </div>
      </div>

      {/* Dyskretna informacja o trybie */}
      <div className="p-3.5 rounded-2xl bg-base-200/60 border border-white/5 flex items-center gap-3 text-xs text-content-muted">
        <Info size={18} className="text-primary shrink-0" />
        <div>
          <span>
            Ten brudnopis aktualizuje się na żywo w trakcie lekcji. Możesz go otworzyć na dowolnym urządzeniu
            (np. telefonie lub tablecie) wchodząc na stronę <strong>cribro.pl/scratchpad</strong> i wpisując swój kod PIN.
          </span>
        </div>
      </div>

      {/* Główny edytor / podgląd */}
      <ScratchpadEditor
        document={document}
        onSaveContent={document.allowStudentEdit ? handleSaveContent : undefined}
        currentUser={{
          uid: user?.id || 'student',
          name: studentName,
          role: 'student',
        }}
        className="min-h-[620px]"
      />
    </div>
  );
};

export default StudentScratchpadScreen;
