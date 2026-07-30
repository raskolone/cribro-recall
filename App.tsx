
import React, { useState } from 'react';
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

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <GlobalErrorBoundary>
          <AppContent />
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

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className={`min-h-screen relative text-content transition-colors duration-300 bg-base-100`}>
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
