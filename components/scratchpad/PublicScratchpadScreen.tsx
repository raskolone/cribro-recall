import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertCircle,
  ArrowLeft,
  Printer,
  Copy,
  Check,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';
import { ScratchpadDocument } from '../../types';
import {
  findScratchpadByPin,
  subscribeScratchpad,
  saveScratchpadContent,
} from '../../services/scratchpadService';
import { formatAccessCode, normalizeAccessCode, isValidAccessCode } from '../../utils/accessCode';
import ScratchpadEditor from './ScratchpadEditor';
import Button from '../ui/Button';

export const PublicScratchpadScreen: React.FC = () => {
  const [pinInput, setPinInput] = useState('');
  const [activePin, setActivePin] = useState<string | null>(null);
  const [document, setDocument] = useState<ScratchpadDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // 1. Sprawdź, czy w adresie URL jest parametr ?pin=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin') || params.get('code') || params.get('p');
    if (pinParam) {
      const normalized = normalizeAccessCode(pinParam);
      setPinInput(formatAccessCode(normalized));
      loadScratchpad(normalized);
    }
  }, []);

  // 2. Subskrypcja Firestore na żywo, gdy dokument jest załadowany
  useEffect(() => {
    if (!document?.id) return;

    const unsubscribe = subscribeScratchpad(
      document.id,
      (updated) => {
        if (updated) {
          setDocument(updated);
        }
      },
      (err) => {
        console.error('Błąd subskrypcji brudnopisu:', err);
      }
    );

    return () => unsubscribe();
  }, [document?.id]);

  const loadScratchpad = async (targetPin: string) => {
    if (!isValidAccessCode(targetPin)) {
      setErrorMessage('Wprowadź poprawny 6-znakowy kod PIN (np. ABC-123).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const doc = await findScratchpadByPin(targetPin);
      if (!doc) {
        setErrorMessage('Nie znaleziono brudnopisu o podanym kodzie PIN. Upewnij się, że kod jest poprawny.');
        setDocument(null);
        setActivePin(null);
      } else {
        setDocument(doc);
        setActivePin(targetPin);
      }
    } catch (err: any) {
      console.error('Błąd ładowania brudnopisu:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas otwierania dokumentu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeAccessCode(pinInput);
    loadScratchpad(normalized);
  };

  const handleLeave = () => {
    setDocument(null);
    setActivePin(null);
    setErrorMessage(null);
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleSaveStudentContent = async (html: string, text: string) => {
    if (!document?.id) return;
    return await saveScratchpadContent(document.id, html, text, {
      uid: 'student_public',
      name: document.studentName || 'Kursant',
      role: 'student',
    });
  };

  const handleCopyAllText = () => {
    if (!document) return;
    navigator.clipboard.writeText(document.contentText || '');
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // EKRAN 1: FORMULARZ KODU PIN (Brak załadowanego dokumentu)
  if (!document) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-4 selection:bg-primary/30">
        <div className="w-full max-w-md">
          {/* Nagłówek i Ikona */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 mb-4 shadow-xl shadow-primary/10">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Cribro <span className="text-primary font-normal">Scratchpad</span>
            </h1>
            <p className="text-content-muted text-sm mt-2">
              Współdzielony brudnopis notatek z lekcji i wspólnej pracy na żywo
            </p>
          </div>

          {/* Karta z formularzem PIN */}
          <div className="bg-base-200/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-error/15 border border-error/30 flex items-start gap-3 text-error text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-content-muted mb-2">
                  Wprowadź kod PIN dokumentu
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={pinInput}
                    onChange={(e) => setPinInput(formatAccessCode(e.target.value))}
                    placeholder="np. ABC-123"
                    maxLength={8}
                    autoFocus
                    className="w-full px-4 py-3.5 bg-base-300/80 border border-white/10 rounded-xl text-center font-mono text-2xl font-bold text-white tracking-widest placeholder:text-content-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted/40 text-xs">
                    PIN
                  </div>
                </div>
                <p className="text-[11px] text-content-muted/70 mt-2 text-center">
                  Kod PIN otrzymasz od swojego lektora lub znajdziesz w podsumowaniu lekcji.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isLoading || !pinInput.trim()}
                className="w-full py-3 text-sm font-bold shadow-lg shadow-primary/20"
              >
                {isLoading ? 'Łączenie z dokumentem...' : 'Otwórz brudnopis →'}
              </Button>
            </form>
          </div>

          {/* Dyskretna stopka */}
          <div className="text-center mt-6 text-xs text-content-muted/60">
            CRIBRO Recall • Platforma Intensywnej Nauki Języka Angielskiego
          </div>
        </div>
      </div>
    );
  }

  // EKRAN 2: WIDOK DOKUMENTU DLA KURSANTA
  return (
    <div className="min-h-screen bg-base-100 flex flex-col selection:bg-primary/30">
      {/* Pasek nawigacyjny na samej górze */}
      <nav className="bg-base-200/90 border-b border-white/10 px-4 py-3 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleLeave}
            className="p-2 rounded-xl bg-base-300 text-content-muted hover:text-white transition-colors cursor-pointer"
            title="Wróć do ekranu głównego"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
              <span>{document.title}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/20">
                {formatAccessCode(document.pin)}
              </span>
            </h1>
            <p className="text-[11px] text-content-muted truncate">
              Prowadzący: <span className="text-white/80">{document.teacherName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyAllText}
            className="text-xs flex items-center gap-1.5"
            title="Kopiuj całą treść notatek"
          >
            {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copiedAll ? 'Skopiowano!' : 'Kopiuj tekst'}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="text-xs flex items-center gap-1.5"
            title="Drukuj lub zapisz jako PDF"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Drukuj / PDF</span>
          </Button>
        </div>
      </nav>

      {/* Główny kontener edytora */}
      <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-5xl w-full mx-auto flex flex-col">
        <ScratchpadEditor
          document={document}
          onSaveContent={document.allowStudentEdit ? handleSaveStudentContent : undefined}
          currentUser={{
            uid: 'student_public',
            name: document.studentName || 'Kursant',
            role: 'student',
          }}
          className="flex-1"
        />
      </main>
    </div>
  );
};

export default PublicScratchpadScreen;
