import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ShieldCheck, Lock, Check, X, ArrowRight, Sparkles, Key } from 'lucide-react';

interface PasswordChangeSuggestionProps {
  onClose?: () => void;
}

export const PasswordChangeSuggestion: React.FC<PasswordChangeSuggestionProps> = ({ onClose }) => {
  const { user, linkGoogleAccount } = useAuth();
  const { language } = useLanguage();

  const [mode, setMode] = useState<'initial' | 'password_form'>('initial');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sprawdzamy, czy konto ma już powiązanego dostawcę Google
  const isGoogleLinked = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

  const handleDismiss = async () => {
    try {
      if (user?.id) {
        await updateDoc(doc(db, 'users', user.id), {
          passwordChangeDismissed: true,
        });
      }
      try {
        localStorage.setItem(`password_change_dismissed_${user?.id}`, 'true');
      } catch (e) {}
      if (onClose) onClose();
    } catch (err) {
      console.error('Błąd podczas odrzucania sugestii zmiany hasła:', err);
      if (onClose) onClose();
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError(language === 'pl' ? 'Hasło musi mieć co najmniej 6 znaków.' : 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(language === 'pl' ? 'Wprowadzone hasła różnią się od siebie.' : 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      if (!auth.currentUser) throw new Error('Brak zalogowanego użytkownika.');
      await updatePassword(auth.currentUser, newPassword);

      if (user?.id) {
        await updateDoc(doc(db, 'users', user.id), {
          requirePasswordChange: false,
          passwordChangeDismissed: true,
          tempPassword: deleteField(),
        });
      }

      setSuccess(language === 'pl' ? 'Twoje hasło zostało pomyślnie zmienione!' : 'Password updated successfully!');
      setTimeout(() => {
        if (onClose) onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Password update error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError(language === 'pl' ? 'Wymagane ponowne logowanie przed zmianą hasła.' : 'Please log in again before changing password.');
      } else {
        setError(err.message || (language === 'pl' ? 'Wystąpił błąd podczas zmiany hasła.' : 'Failed to update password.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await linkGoogleAccount();
      if (user?.id) {
        await updateDoc(doc(db, 'users', user.id), {
          requirePasswordChange: false,
          passwordChangeDismissed: true,
          tempPassword: deleteField(),
        });
      }
      setSuccess(language === 'pl' ? 'Konto Google zostało pomyślnie połączone! Możesz teraz logować się jednym kliknięciem.' : 'Google account linked successfully! You can now log in with one click.');
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Google linking error:', err);
      if (err.code === 'auth/credential-already-in-use') {
        setError(language === 'pl' ? 'To konto Google jest już powiązane z innym profilem.' : 'This Google account is already linked to another user.');
      } else if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err.message || (language === 'pl' ? 'Nie udało się powiązać z kontem Google.' : 'Failed to link Google account.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-ink-2 via-base-200/90 to-base-300/80 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.5),0_0_20px_rgba(114,240,180,0.12)]">
      {/* Decorative top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />

      {/* Close button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi transition-colors cursor-pointer"
        title={language === 'pl' ? 'Zamknij sugestię' : 'Dismiss suggestion'}
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left icon + text */}
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/30 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                {language === 'pl' ? 'Pierwsze logowanie' : 'First Sign-in'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-content-muted border border-white/10">
                {language === 'pl' ? 'Opcjonalne' : 'Optional'}
              </span>
            </div>
            <h4 className="text-base font-bold text-white leading-snug">
              {language === 'pl'
                ? 'Ustaw własne hasło lub połącz konto z Google'
                : 'Set your own password or connect Google account'}
            </h4>
            <p className="text-xs text-content-muted leading-relaxed">
              {language === 'pl'
                ? 'Obecnie korzystasz z hasła tymczasowego. Możesz zmienić je na łatwiejsze do zapamiętania lub powiązać konto z Google, aby w przyszłości logować się jednym kliknięciem.'
                : 'You are currently using a temporary password. Change it to your own or link your Google account for easy one-click logins in the future.'}
            </p>
          </div>
        </div>

        {/* Right action buttons / form */}
        {mode === 'initial' ? (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end shrink-0">
            {/* Google Linking Button */}
            {!isGoogleLinked && (
              <button
                type="button"
                onClick={handleLinkGoogle}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{language === 'pl' ? 'Połącz z Google' : 'Link Google'}</span>
              </button>
            )}

            {/* Change Password Button */}
            <button
              type="button"
              onClick={() => setMode('password_form')}
              className="px-3.5 py-2 rounded-xl bg-primary hover:brightness-110 text-accent-ink font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(114,240,180,0.3)]"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{language === 'pl' ? 'Zmień hasło' : 'Change password'}</span>
            </button>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi font-medium text-xs border border-white/10 transition-colors cursor-pointer"
            >
              {language === 'pl' ? 'Pomiń na razie' : 'Dismiss'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={language === 'pl' ? 'Nowe hasło (min. 6 znaków)' : 'New password (min 6 chars)'}
                className="w-full sm:w-48 px-3 py-1.5 rounded-xl bg-black/40 border border-white/20 text-white text-xs focus:outline-none focus:border-primary placeholder:text-content-muted"
                autoFocus
              />
            </div>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === 'pl' ? 'Powtórz nowe hasło' : 'Confirm password'}
                className="w-full sm:w-44 px-3 py-1.5 rounded-xl bg-black/40 border border-white/20 text-white text-xs focus:outline-none focus:border-primary placeholder:text-content-muted"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-xl bg-primary hover:brightness-110 text-accent-ink font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                {isLoading ? (language === 'pl' ? 'Zapisywanie...' : 'Saving...') : (language === 'pl' ? 'Zapisz' : 'Save')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('initial'); setError(''); }}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi text-xs border border-white/10 transition-colors cursor-pointer"
              >
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Error or Success feedback message */}
      {error && (
        <div className="mt-3 p-2.5 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-3 p-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs flex items-center gap-2 font-semibold">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
};

export default PasswordChangeSuggestion;
