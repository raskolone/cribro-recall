
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VocabularyProvider } from './context/VocabularyContext';
import { LanguageProvider } from './context/LanguageContext';
import { FlashcardProvider } from './context/FlashcardContext';
import { SettingsProvider } from './context/SettingsContext';
import AuthScreen from './components/auth/AuthScreen';
import Dashboard from './components/dashboard/Dashboard';
import LandingPage from './components/landing/LandingPage';
import ConstellationBackground from './components/ui/ConstellationBackground';

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
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
    <div className={`min-h-screen relative text-content transition-colors duration-300 bg-transparent`}>
      <ConstellationBackground />
      
      <div className="relative z-10 w-full min-h-screen pointer-events-auto flex flex-col">
        {user ? (
          <VocabularyProvider>
            <SettingsProvider>
            <FlashcardProvider>
              <Dashboard />
            </FlashcardProvider>
            </SettingsProvider>
          </VocabularyProvider>
        ) : showAuth ? (
          <AuthScreen onBack={() => setShowAuth(false)} />
        ) : (
          <LandingPage onLoginClick={() => setShowAuth(true)} />
        )}
      </div>
    </div>
  );
};

export default App;
