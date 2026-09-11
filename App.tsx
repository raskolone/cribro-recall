
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VocabularyProvider } from './context/VocabularyContext';
import { LanguageProvider } from './context/LanguageContext';
import { FlashcardProvider } from './context/FlashcardContext';
import { SettingsProvider } from './context/SettingsContext';
import AuthScreen from './components/auth/AuthScreen';
import Dashboard from './components/dashboard/Dashboard';
import LandingPage from './components/landing/LandingPage';
import ForcePasswordChangeScreen from './components/auth/ForcePasswordChangeScreen';
import GlobalErrorBoundary from './components/ui/GlobalErrorBoundary';
import ConstellationBackground from './components/ui/ConstellationBackground';
import StarterVocabularyApp from './components/starter/StarterVocabularyApp';
import PublicTestScreen, { publicTestCodeFromLocation } from './components/tests/PublicTestScreen';
import PresenterScreen from './components/admin/presentation/PresenterScreen';
import { AdminAIActivityMonitor } from './components/admin/AdminAIActivityMonitor';
import { handleGlobalEscape } from './utils/modalStack';
import AppAlertModal from './components/ui/AppAlertModal';
import UnsubscribeScreen from './components/auth/UnsubscribeScreen';
import DirectHomeworkScreen from './components/dashboard/DirectHomeworkScreen';
import LiveJoinScreen from './components/presentation/LiveJoinScreen';
import PublicScratchpadScreen from './components/scratchpad/PublicScratchpadScreen';


const App: React.FC = () => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const handled = handleGlobalEscape();
        if (!handled) {
          window.dispatchEvent(new CustomEvent('close-modal'));
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <GlobalErrorBoundary>
          <AppContent />
          <AdminAIActivityMonitor />
          <AppAlertModal />
        </GlobalErrorBoundary>
      </AuthProvider>
    </LanguageProvider>
  );
};

const ViewSwitcher: React.FC<{currentView: string, children: React.ReactNode}> = ({ currentView, children }) => {
  return <div className="w-full flex-1 flex flex-col transition-opacity duration-300 animate-in fade-in">{children}</div>;
};

const AppContent: React.FC = () => {

  const { user, isAuthReady } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (typeof window !== 'undefined' && window.location.pathname === '/starter') {
    return <StarterVocabularyApp />;
  }

  // Wypisanie się z powiadomień e-mail (Resend). Działa bez konieczności
  // logowania — kursant klika link z poczty na dowolnym urządzeniu.
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/unsubscribe') || window.location.pathname.startsWith('/wypisz'))) {
    return <UnsubscribeScreen />;
  }

  // Test poziomujący z linku. Stoi przed sprawdzeniem logowania, bo kandydat
  // z definicji nie ma konta — czekanie na `isAuthReady` pokazywałoby mu
  // najpierw spinner, a potem ekran logowania, którego nie potrzebuje.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/test')) {
    return <PublicTestScreen initialCode={publicTestCodeFromLocation()} />;
  }

  // Okno prezentacji dla kursanta. Stoi przed sprawdzeniem logowania, bo jest
  // otwierane w nowej karcie i ma pokazywać slajd od razu, bez ekranu logowania
  // w środku lekcji.
  //
  // `SettingsProvider` jest tu konieczny: slajdy renderują przyciski wymowy,
  // a te sięgają po ustawienia lektora. Bez providera okno wywracało się
  // dokładnie w chwili, w której prowadzący odkrywał odpowiedź — czyli w środku
  // ćwiczenia. Provider startuje z ustawień domyślnych, więc brak zalogowania
  // niczego tu nie blokuje.
  // Dokładne dopasowanie, nie `startsWith`: to okno nie ma parametrów w adresie,
  // a przedrostek złapałby też każdą przyszłą ścieżkę zaczynającą się tak samo.
  if (typeof window !== 'undefined' && /^\/present\/?$/.test(window.location.pathname)) {
    return (
      <SettingsProvider>
        <PresenterScreen />
      </SettingsProvider>
    );
  }

  // Bezpośredni dostęp do pracy domowej z unikalnego linku z e-maila (bez konieczności logowania).
  // Kursant natychmiast przechodzi do rozwiązywania zadania z tokenem ważnym przez 14 dni.
  // Zapis i ewaluacja odpowiedzi trafiają wprost na profil kursanta (practiceLogs, specialTasks).
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/hw') || window.location.pathname.startsWith('/homework-direct'))) {
    return (
      <SettingsProvider>
        <DirectHomeworkScreen />
      </SettingsProvider>
    );
  }

  // Prezentacja i lekcja na żywo (E-learning z kodem PIN lub linkiem /live?pin=...)
  // Kursant dołącza bez rejestracji i widzi prezentację sterowaną w czasie rzeczywistym przez lektora.
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/live') || window.location.pathname.startsWith('/join'))) {
    return (
      <SettingsProvider>
        <LiveJoinScreen />
      </SettingsProvider>
    );
  }

  // Współdzielony dokument brudnopisu (Scratchpad / Google Docs z kodem PIN lub linkiem /scratchpad?pin=...)
  // Kursant może zawsze podejrzeć ten brudnopis lub edytować notatki bez konieczności logowania.
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/scratchpad') || window.location.pathname.startsWith('/doc'))) {
    return (
      <SettingsProvider>
        <PublicScratchpadScreen />
      </SettingsProvider>
    );
  }



  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    // Bez własnego tła: gradient strony żyje na <body> (design/theme/tokens.css),
    // żeby kanwa konstelacji mogła się przez niego przebijać.
    <div className={`min-h-screen relative text-content transition-colors duration-300`}>
      <ConstellationBackground />
      <div className="relative z-10 w-full min-h-screen pointer-events-auto flex flex-col">
        
        <ViewSwitcher currentView={user ? ((user.requirePasswordChange && (user.tempPasswordLogins || 0) > 3) ? 'force-password-change' : 'dashboard') : showAuth ? 'auth' : 'landing'}>
          {user ? (
            (user.requirePasswordChange && (user.tempPasswordLogins || 0) > 3) ? (
              <ForcePasswordChangeScreen />
            ) : (
              <div className="w-full flex-1 flex flex-col">
                <VocabularyProvider>
                  <SettingsProvider>
                  <FlashcardProvider>
                    <Dashboard />
                  </FlashcardProvider>
                  </SettingsProvider>
                </VocabularyProvider>
              </div>
            )
          ) : showAuth ? (
            <div className="w-full flex-1 flex flex-col">
              <AuthScreen onBack={() => setShowAuth(false)} />
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              <LandingPage onLoginClick={() => setShowAuth(true)} />
            </div>
          )}
        </ViewSwitcher>

      </div>
    </div>
  );
};

export default App;
