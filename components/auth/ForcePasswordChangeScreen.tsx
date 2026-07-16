import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Lock, Mail, ShieldAlert } from 'lucide-react';

const ForcePasswordChangeScreen: React.FC = () => {
  const { user, linkGoogleAccount, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePassword = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Hasła nie pasują do siebie.');
      return;
    }

    setIsLoading(true);
    try {
      if (!auth.currentUser) throw new Error('Brak zalogowanego użytkownika.');
      await updatePassword(auth.currentUser, newPassword);
      
      if (user?.id) {
        await updateDoc(doc(db, 'users', user.id), { requirePasswordChange: false });
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Musisz zalogować się ponownie przed zmianą hasła. Wyloguj się i zaloguj jeszcze raz.');
      } else {
        setError(err.message || 'Wystąpił błąd podczas zmiany hasła.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLink = async () => {
    setError('');
    setIsLoading(true);
    try {
      await linkGoogleAccount();
      if (user?.id) {
        await updateDoc(doc(db, 'users', user.id), { requirePasswordChange: false });
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/credential-already-in-use') {
        setError('To konto Google jest już powiązane z innym użytkownikiem.');
      } else {
        setError(err.message || 'Wystąpił błąd podczas łączenia z kontem Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl relative overflow-hidden border-orange-500/30">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500"></div>
        <div className="flex flex-col items-center mb-6 pt-4">
          <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-center">Witaj w ZEIAN!</h2>
          <p className="text-content-muted text-center text-sm mt-2">
            Ze względów bezpieczeństwa musisz zmienić hasło tymczasowe na własne lub powiązać konto z Google.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
              Ustaw nowe hasło
            </label>
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-content-muted" />
              </div>
              <input
                type="password"
                placeholder="Nowe hasło (min. 6 znaków)"
                className="w-full bg-base-100 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-content-muted focus:outline-none focus:border-primary/50 transition-colors"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-content-muted" />
              </div>
              <input
                type="password"
                placeholder="Potwierdź nowe hasło"
                className="w-full bg-base-100 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-content-muted focus:outline-none focus:border-primary/50 transition-colors"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleUpdatePassword} isLoading={isLoading} disabled={!newPassword || !confirmPassword}>
              Zapisz nowe hasło
            </Button>
          </div>

          <div className="relative py-4 flex items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-content-muted text-sm font-bold uppercase">ALBO</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <div>
            <Button
              onClick={handleGoogleLink}
              variant="secondary"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 border-transparent transition-all"
              isLoading={isLoading}
            >
              <span className="font-bold">Połącz z kontem Google</span>
            </Button>
            <p className="text-center text-xs text-content-muted mt-3">
              Logowanie przez Google jest szybsze i bezpieczniejsze.
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-white/5 text-center">
            <button onClick={logout} className="text-sm text-content-muted hover:text-white underline-offset-4 hover:underline">
              Wyloguj mnie
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ForcePasswordChangeScreen;
