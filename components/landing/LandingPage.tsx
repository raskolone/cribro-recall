import React, { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Typewriter from './Typewriter';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Mail, Sparkles, Brain, Ear, Activity } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { login } = useAuth();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await login();
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
        console.error("Google login failed:", error);
      }
    }
  };

  const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="bg-base-200/50 backdrop-blur-sm border border-white/5 p-6 rounded-2xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 group">
      <Icon className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
      <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
      <p className="text-content-muted text-xs font-mono uppercase tracking-widest">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-content relative overflow-hidden font-sans bg-transparent flex items-center">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex justify-end items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="font-mono text-sm border border-white/10 px-3 py-1 rounded flex gap-2">
          <button 
            onClick={() => setLanguage('pl')} 
            className={`hover:text-primary transition-colors ${language === 'pl' ? 'text-primary font-bold' : 'text-content-muted'}`}
          >
            PL
          </button>
          <span className="text-white/20">|</span>
          <button 
            onClick={() => setLanguage('en')} 
            className={`hover:text-primary transition-colors ${language === 'en' ? 'text-primary font-bold' : 'text-content-muted'}`}
          >
            EN
          </button>
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        
        {/* Left Column - Content */}
        <div className={`flex-1 transition-all duration-1000 transform space-y-8 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo Icon */}
          <div className="w-16 h-16 rounded-2xl bg-base-200 border border-primary/20 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(114,240,180,0.1)]">
            <div className="relative">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M28 10 A 15 15 0 1 0 28 30" stroke="#72f0b4" strokeWidth="3" strokeLinecap="round" />
                <path d="M 23 23 A 8 8 0 1 1 23 11" fill="none" stroke="#72f0b4" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="23" cy="23" r="2.5" fill="#72f0b4" />
              </svg>
            </div>
          </div>

          <div className="space-y-[-0.2em]">
            <h1 className="text-7xl lg:text-[110px] font-display font-black leading-none tracking-tight text-white drop-shadow-sm">
              CRIBRO
            </h1>
            <h1 className="text-7xl lg:text-[110px] font-display font-black leading-none tracking-tight text-primary drop-shadow-[0_0_20px_rgba(114,240,180,0.2)]">
              ENGLISH
            </h1>
          </div>
          
          <div className="text-xl md:text-2xl font-mono text-primary mb-8 h-8 flex items-center gap-2">
            <span>Your personal</span>
            <Typewriter words={['language coach.', 'vocabulary builder.', 'native speaker.', 'study assistant.']} />
          </div>

          <p className="text-lg text-content-muted leading-relaxed max-w-xl">
            {language === 'pl' 
              ? 'Nauka angielskiego bez szumu. Zbuduj swoje słownictwo z pomocą AI, ucz się dzięki inteligentnym powtórkom i osiągaj płynność szybciej.' 
              : 'English learning without the noise. Build your vocabulary with AI, learn through smart repetition, and achieve fluency faster.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 max-w-xl">
            <FeatureCard icon={Sparkles} title="AI Generation" description={language === 'pl' ? 'SPERSONALIZOWANE SŁOWA' : 'PERSONALIZED WORDS'} />
            <FeatureCard icon={Brain} title="Smart Sync" description={language === 'pl' ? 'SYSTEM POWTÓREK' : 'SPACED REPETITION'} />
            <FeatureCard icon={Activity} title="Interactive" description={language === 'pl' ? '4 TRYBY NAUKI' : '4 PRACTICE MODES'} />
            <FeatureCard icon={Ear} title="Audio" description={language === 'pl' ? 'NATYWNA WYMOWA' : 'NATIVE PRONUNCIATION'} />
          </div>
        </div>

        {/* Right Column - Login Panel */}
        <div className={`w-full lg:w-[480px] transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-base-200/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 sm:p-12 shadow-[0_30px_60px_rgba(0,0,0,0.4)] relative">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-bold text-white">Start here</h2>
            </div>

            <div className="space-y-6">
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-base-100 hover:bg-base-300 border border-white/10 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(114,240,180,0.1)]"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Login with Google</span>
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] font-mono text-content-muted uppercase tracking-widest">or email / username</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              <button
                onClick={onLoginClick}
                className="w-full bg-black/40 hover:bg-black/60 border border-white/5 text-white font-medium py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-colors"
              >
                <Mail className="w-5 h-5 text-content-muted" />
                <span>Sign in with Email / Username</span>
              </button>

              <div className="pt-4 text-center">
                <button 
                  onClick={onLoginClick}
                  className="text-xs text-content-muted hover:text-white transition-colors"
                >
                  No account? Register here
                </button>
              </div>
            </div>
          </div>
        </div>
        
      </main>
    </div>
  );
};

export default LandingPage;
