import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, RotateCcw } from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import ConstellationBackground from '../ui/ConstellationBackground';
import { toPolishVocative } from '../../utils/polishVocative';

export const UnsubscribeScreen: React.FC = () => {
  const [phase, setPhase] = useState<'loading' | 'unsubscribed' | 'resubscribed' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isProcessingUndo, setIsProcessingUndo] = useState(false);

  const getParams = () => {
    if (typeof window === 'undefined') return { uid: '', token: '' };
    const params = new URLSearchParams(window.location.search);
    return {
      uid: params.get('uid') || '',
      token: params.get('token') || '',
    };
  };

  const { uid, token } = getParams();

  useEffect(() => {
    if (!uid || !token) {
      setPhase('error');
      setErrorMessage('Niepełny link rezygnacji. Upewnij się, że skopiowano cały adres z wiadomości e-mail.');
      return;
    }

    const performUnsubscribe = async () => {
      try {
        const res = await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, token }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Nie udało się zaktualizować ustawień powiadomień.');
        }

        setUserEmail(data.email || '');
        setUserName(data.name || '');
        setPhase('unsubscribed');
      } catch (err: any) {
        setPhase('error');
        setErrorMessage(err?.message || 'Wystąpił błąd podczas wypisywania z powiadomień.');
      }
    };

    performUnsubscribe();
  }, [uid, token]);

  const handleResubscribe = async () => {
    if (!uid || !token || isProcessingUndo) return;
    setIsProcessingUndo(true);
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, action: 'resubscribe' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Nie udało się ponownie włączyć powiadomień.');
      }

      setPhase('resubscribed');
    } catch (err: any) {
      alert(err?.message || 'Błąd ponownego włączania powiadomień.');
    } finally {
      setIsProcessingUndo(false);
    }
  };

  return (
    <div className="min-h-screen relative text-content flex flex-col items-center justify-center p-4">
      <ConstellationBackground />

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <BrandLogo className="text-2xl justify-center inline-flex" />
        </div>

        <div className="liquid-glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
          {phase === 'loading' && (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 animate-pulse">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-white">Przetwarzanie rezygnacji...</h2>
              <p className="text-sm text-content-muted">
                Zapisujemy Twoją dyspozycję w systemie powiadomień.
              </p>
            </div>
          )}

          {phase === 'unsubscribed' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-[0_0_20px_rgba(114,240,180,0.25)]">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Powiadomienia e-mail wyłączone
                </h2>
                <p className="text-sm text-content-muted mt-2 leading-relaxed">
                  {userName ? `Cześć ${toPolishVocative(userName)}, ` : ''}dla Twojego konta{' '}
                  {userEmail && <strong className="text-white font-mono">({userEmail})</strong>}{' '}
                  wyłączyliśmy e-maile z powiadomieniami o nowych pracach domowych oraz przypomnieniach.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-left text-xs text-content-muted space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Mail size={14} className="text-primary" />
                  Nikogo nie chcemy spamować
                </p>
                <p>
                  Twoje konto, postępy oraz dostęp do zadań w aplikacji pozostają nienaruszone. Zadania możesz w dowolnym momencie sprawdzić po zalogowaniu na platformie.
                </p>
              </div>

              <div className="pt-3 flex flex-col gap-2.5">
                <button
                  onClick={handleResubscribe}
                  disabled={isProcessingUndo}
                  className="w-full py-2.5 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
                >
                  {isProcessingUndo ? (
                    <Loader2 size={14} className="animate-spin text-primary" />
                  ) : (
                    <RotateCcw size={14} className="text-primary" />
                  )}
                  Cofnij — włącz powiadomienia z powrotem
                </button>

                <a
                  href="/"
                  className="w-full py-2.5 px-4 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-btn hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} />
                  Przejdź do aplikacji
                </a>
              </div>
            </div>
          )}

          {phase === 'resubscribed' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 text-primary border border-primary/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Powiadomienia zostały ponownie włączone!
                </h2>
                <p className="text-sm text-content-muted mt-2 leading-relaxed">
                  Będziesz ponownie otrzymywać e-maile o nowych zadaniach od swojego lektora.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href="/"
                  className="w-full py-2.5 px-4 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-btn hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} />
                  Przejdź do aplikacji
                </a>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger/20 text-danger border border-danger/30">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Nie udało się przetworzyć linku</h2>
                <p className="text-sm text-content-muted mt-2 leading-relaxed">
                  {errorMessage}
                </p>
              </div>

              <div className="pt-2">
                <a
                  href="/"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} />
                  Wróć do strony głównej
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnsubscribeScreen;
