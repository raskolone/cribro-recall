
import React, { useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useRef, useEffect } from 'react';
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


const GSAPViewSwitcher: React.FC<{currentView: string, children: React.ReactNode}> = ({ currentView, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current.firstElementChild;
      if (el) {
        gsap.fromTo(el, 
          { opacity: 0, y: 30 }, 
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }
        );
      }
    }
  }, [currentView]);

  return <div ref={containerRef} className="w-full flex-1 flex flex-col">{children}</div>;
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
        
        <GSAPViewSwitcher currentView={user ? 'dashboard' : showAuth ? 'auth' : 'landing'}>
          {user ? (
            <div className="w-full flex-1 flex flex-col">
              <VocabularyProvider>
                <SettingsProvider>
                <FlashcardProvider>
                  <Dashboard />
                </FlashcardProvider>
                </SettingsProvider>
              </VocabularyProvider>
            </div>
          ) : showAuth ? (
            <div className="w-full flex-1 flex flex-col">
              <AuthScreen onBack={() => setShowAuth(false)} />
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              <LandingPage onLoginClick={() => setShowAuth(true)} />
            </div>
          )}
        </GSAPViewSwitcher>

      </div>
    </div>
  );
};

export default App;
