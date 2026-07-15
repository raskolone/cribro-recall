
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
        <AnimatePresence mode="wait">
          {user ? (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="w-full flex-1 flex flex-col">
              <VocabularyProvider>
                <SettingsProvider>
                <FlashcardProvider>
                  <Dashboard />
                </FlashcardProvider>
                </SettingsProvider>
              </VocabularyProvider>
            </motion.div>
          ) : showAuth ? (
            <motion.div key="auth" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="w-full flex-1 flex flex-col">
              <AuthScreen onBack={() => setShowAuth(false)} />
            </motion.div>
          ) : (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="w-full flex-1 flex flex-col">
              <LandingPage onLoginClick={() => setShowAuth(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
