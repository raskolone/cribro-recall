import React, { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Typewriter from './Typewriter';
import NodeGraph from './NodeGraph';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface LandingPageProps {
  onLoginClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { loginAnonymously } = useAuth();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleDemoClick = async () => {
    setIsDemoLoading(true);
    try {
      await loginAnonymously();
    } catch (error) {
      console.error("Demo login failed:", error);
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-content relative overflow-hidden font-sans bg-transparent">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-10 flex justify-between items-start px-8 py-6 max-w-7xl mx-auto">
        <a href="https://www.maciej.pro" target="_blank" rel="noopener noreferrer" className="group flex flex-col">
          <span className="text-xl font-display font-bold tracking-wider group-hover:text-primary transition-colors">MW.</span>
          <span className="text-[10px] font-mono text-content-muted group-hover:text-primary/80 transition-colors uppercase tracking-widest mt-0.5">{t('nav.creator')}</span>
        </a>
        <div className="flex items-center gap-8">
          <div className="font-mono text-sm border border-white/20 px-3 py-1 rounded flex gap-2">
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
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-20">
        
        {/* Hero Section */}
        <section className={`flex flex-col items-center text-center transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative mb-8 group">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-primary p-1 shadow-[0_0_20px_rgba(74,222,128,0.4)] group-hover:shadow-[0_0_30px_rgba(74,222,128,0.6)] transition-all duration-500 bg-base-200 relative">
              <img 
                src="https://picsum.photos/seed/maciej/200/200" 
                alt="Maciej Wyrozumski" 
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-primary rounded-full border-2 border-base-100 shadow-[0_0_10px_rgba(74,222,128,0.8)]"></div>
            </div>
          </div>

          <h2 className="text-sm md:text-base font-sans tracking-[0.3em] text-content-muted uppercase mb-4">
            {t('hero.subtitle')}
          </h2>
          
          <h1 className="text-6xl md:text-8xl lg:text-[100px] font-display font-black leading-tight mb-6">
            {t('hero.title')}
          </h1>
          
          <div className="text-xl md:text-2xl font-sans text-content-muted mb-12 h-8">
            <Typewriter words={['AI-Powered Learning.', 'Smart Flashcards.', 'Native Pronunciation.', 'Spaced Repetition.']} />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={onLoginClick} className="text-lg px-10 py-4 w-full sm:w-auto">
              {t('hero.start')}
            </Button>
            <Button 
              onClick={handleDemoClick} 
              variant="secondary" 
              className="text-lg px-10 py-4 w-full sm:w-auto hover:bg-base-300"
              isLoading={isDemoLoading}
            >
              {language === 'pl' ? 'Wypróbuj Demo' : 'Try Demo'}
            </Button>
          </div>
        </section>

        {/* About / Features Section */}
        <section className={`mt-32 transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-4 mb-12">
            <span className="font-mono text-xs tracking-[0.25em] text-primary uppercase whitespace-nowrap">{t('about.title')}</span>
            <div className="h-[1px] w-full bg-white/10"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-4">
              <h3 className="text-4xl md:text-5xl font-display font-bold leading-tight">{t('about.word1')}</h3>
              <h3 className="text-4xl md:text-5xl font-display font-bold leading-tight text-content-muted">{t('about.word2')}</h3>
              <h3 className="text-4xl md:text-5xl font-display font-bold leading-tight text-white/30">{t('about.word3')}</h3>
            </div>
            
            <div className="space-y-8">
              <p className="text-lg text-[#d0d0d0] leading-[1.7]">
                {t('about.desc')}
              </p>
              
              <div className="flex flex-wrap gap-3">
                {['AI Generation', 'Flashcards', 'Quizzes', 'Spaced Repetition', 'English', 'Spanish', 'French'].map(tag => (
                  <span key={tag} className="bg-primary/10 border border-primary/40 text-primary rounded-[6px] px-4 py-1.5 text-xs font-mono hover:bg-primary/20 hover:shadow-[0_0_8px_rgba(74,222,128,0.3)] transition-all cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={`mt-32 transition-all duration-1000 delay-500 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-4 mb-12">
            <span className="font-mono text-xs tracking-[0.25em] text-primary uppercase whitespace-nowrap">{t('stats.title')}</span>
            <div className="h-[1px] w-full bg-white/10"></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-12 sm:gap-32">
            <div>
              <div className="text-5xl font-bold text-primary mb-2">4+</div>
              <div className="text-sm font-sans text-content-muted">{t('stats.languages')}</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-primary mb-2">∞</div>
              <div className="text-sm font-sans text-content-muted">{t('stats.words')}</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-primary mb-2">4</div>
              <div className="text-sm font-sans text-content-muted">{t('stats.modes')}</div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
