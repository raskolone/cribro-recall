
import React, { useState, useEffect, useRef } from 'react';

import { Sparkles, Brain, Activity, Ear, Mail, ChevronRight, CheckCircle2, Star, Lightbulb, Play } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import i18n from "i18next";


const Typewriter = ({ words, loop }: { words: string[], loop: boolean }) => {
  const [currentWord, setCurrentWord] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const word = words[wordIndex];
    let timeout: NodeJS.Timeout;
    
    if (isDeleting) {
      if (currentWord === '') {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
        timeout = setTimeout(() => {}, 500);
      } else {
        timeout = setTimeout(() => {
          setCurrentWord(word.substring(0, currentWord.length - 1));
        }, 50);
      }
    } else {
      if (currentWord === word) {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      } else {
        timeout = setTimeout(() => {
          setCurrentWord(word.substring(0, currentWord.length + 1));
        }, 100);
      }
    }
    return () => clearTimeout(timeout);
  }, [currentWord, isDeleting, wordIndex, words]);

  return <span>{currentWord}<span className="animate-pulse">|</span></span>;
};


const MockupWindow = ({ children, title }: { children: React.ReactNode, title?: string }) => (
  <div className="relative w-full rounded-2xl liquid-glass-panel border border-white/10 overflow-hidden shadow-2xl group hover:border-primary/30 transition-colors duration-500">
    <div className="h-8 bg-black/40 border-b border-white/5 flex items-center px-4 gap-2">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      {title && <span className="ml-2 text-[10px] font-mono text-white/30 uppercase">{title}</span>}
    </div>
    <div className="p-4 sm:p-6 bg-[#0B0F19]">
      {children}
    </div>
  </div>
);

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
    <div className="liquid-glass-card p-6 group cursor-default">
      <Icon className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
      <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
      <p className="text-content-muted text-xs font-mono uppercase tracking-widest">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-content relative overflow-y-auto overflow-x-hidden font-sans bg-transparent scrollbar-hide">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex justify-end items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="font-mono text-sm border border-white/10 px-3 py-1 rounded flex gap-2">
          <button 
            onClick={() => setLanguage('pl')} 
            className={`hover:text-primary transition-colors ${language === 'pl' ? 'text-primary font-bold' : 'text-content-muted'}`}
          >
            {i18n.t("PL")}
          </button>
          <span className="text-white/20">|</span>
          <button 
            onClick={() => setLanguage('en')} 
            className={`hover:text-primary transition-colors ${language === 'en' ? 'text-primary font-bold' : 'text-content-muted'}`}
          >
            {i18n.t("EN")}
          </button>
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center">
        
        {/* Hero Section */}
        <div className="w-full flex flex-col lg:flex-row items-center gap-16 lg:gap-24 mb-32">
          {/* Left Column - Content */}
          <div className={`flex-1 transition-all duration-1000 transform space-y-8 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Logo Icon */}
            <div className="w-16 h-16 rounded-2xl liquid-glass-card flex items-center justify-center mb-8 !rounded-2xl shadow-[0_0_30px_rgba(114,240,180,0.15)]">
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
                {i18n.t("CRIBRO")}
              </h1>
              <h1 className="text-7xl lg:text-[110px] font-display font-black leading-none tracking-tight text-primary drop-shadow-[0_0_20px_rgba(114,240,180,0.2)]">
                {i18n.t("ENGLISH")}
              </h1>
            </div>
            
            <div className="text-xl md:text-2xl font-mono text-primary mb-8 h-8 flex items-center gap-2">
              <span>{i18n.t("Your personal")}</span>
              <Typewriter words={['language coach.', 'vocabulary builder.', 'native speaker.', 'study assistant.']} loop={true} />
            </div>

            <p className="text-lg text-content-muted leading-relaxed max-w-xl">
              {language === 'pl' 
                ? 'Nauka angielskiego bez szumu. Zbuduj swoje słownictwo z pomocą AI, ucz się dzięki inteligentnym powtórkom i osiągaj płynność szybciej.' 
                : 'English learning without the noise. Build your vocabulary with AI, learn through smart repetition, and achieve fluency faster.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 max-w-xl">
              <FeatureCard icon={Sparkles} title={i18n.t("AI Generation")} description={language === 'pl' ? 'SPERSONALIZOWANE SŁOWA' : 'PERSONALIZED WORDS'} />
              <FeatureCard icon={Brain} title={i18n.t("Smart Sync")} description={language === 'pl' ? 'SYSTEM POWTÓREK' : 'SPACED REPETITION'} />
              <FeatureCard icon={Activity} title={i18n.t("Interactive")} description={language === 'pl' ? '4 TRYBY NAUKI' : '4 PRACTICE MODES'} />
              <FeatureCard icon={Ear} title={i18n.t("Audio")} description={language === 'pl' ? 'NATYWNA WYMOWA' : 'NATIVE PRONUNCIATION'} />
            </div>
          </div>

          {/* Right Column - Login Panel */}
          <div className={`w-full lg:w-[480px] transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="liquid-glass-panel rounded-[32px] p-8 sm:p-12 relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
              <div className="absolute inset-0 bg-primary/5 rounded-[32px] blur-3xl -z-10"></div>
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-bold text-white">{i18n.t("Start here")}</h2>
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
                  <span>{i18n.t("Login with Google")}</span>
                </button>
                
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink-0 mx-4 text-[10px] font-mono text-content-muted uppercase tracking-widest">{i18n.t("or email / username")}</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full bg-black/40 hover:bg-black/60 border border-white/5 text-white font-medium py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-colors"
                >
                  <Mail className="w-5 h-5 text-content-muted" />
                  <span>{i18n.t("Sign in with Email / Username")}</span>
                </button>
                
                <div className="pt-4 text-center">
                  <button 
                    onClick={onLoginClick}
                    className="text-xs text-content-muted hover:text-white transition-colors"
                  >
                    {i18n.t("No account? Register here")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Showcase Section */}
        <div className={`w-full transition-all duration-1000 delay-500 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">
              {language === 'pl' ? 'Jak to działa?' : 'How it works'}
            </h2>
            <p className="text-content-muted max-w-2xl mx-auto text-lg">
              {language === 'pl' 
                ? 'Poznaj interfejs stworzony do skupienia. Od konfiguracji wyzwania, przez inteligentny trening, aż do głębokiej analizy AI.' 
                : 'Experience an interface built for focus. From challenge configuration to smart training and deep AI analysis.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            {/* Feature 1: The Training */}
            <div className="space-y-6 lg:pr-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                {language === 'pl' ? 'Prawdziwe wyzwanie' : 'Real Challenge'}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {language === 'pl' ? 'Pisz i weryfikuj w czasie rzeczywistym' : 'Type and verify in real-time'}
              </h3>
              <p className="text-content-muted text-lg">
                {language === 'pl' 
                  ? 'Koniec z nudnym wybieraniem opcji A/B/C. Nasz inteligentny system sprawdza Twoje tłumaczenia i daje natychmiastowy feedback. Trenuj układając słowa lub pisząc pełne zdania.' 
                  : 'No more boring A/B/C choices. Our smart system checks your translations and gives instant feedback. Train by ordering words or typing full sentences.'}
              </p>
            </div>
            
            <div className="relative">
              <MockupWindow title={language === 'pl' ? 'Trening Tłumaczeń' : 'Translation Training'}>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-content-muted font-mono">Postęp: 1 / 5</span>
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-1/5 h-full bg-primary rounded-full"></div>
                    </div>
                  </div>
                  
                  <div className="rounded-2xl border border-white/10 p-6 bg-base-200/50 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white/10 px-3 py-1 rounded-b-lg text-xs font-bold text-primary">
                      {language === 'pl' ? 'Zdanie 1' : 'Sentence 1'}
                    </div>
                    <h4 className="text-xl md:text-2xl font-bold text-white mt-4 mb-6">
                      {language === 'pl' ? 'Lubię czytać książki w wolnym czasie.' : 'I like reading books in my free time.'}
                    </h4>
                    <button className="text-yellow-500 text-sm font-bold flex items-center justify-center gap-2 mx-auto hover:text-yellow-400">
                      <Lightbulb size={16} /> {language === 'pl' ? 'Pokaż wskazówkę' : 'Show hint'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-primary tracking-widest uppercase text-center block">
                      {language === 'pl' ? 'Twoje tłumaczenie na angielski:' : 'Your translation to English:'}
                    </label>
                    <textarea 
                      disabled
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-base resize-none focus:outline-none"
                      rows={2}
                      value={language === 'pl' ? 'I usually go to the gym after work.' : 'I like reading books in my free time.'}
                    />
                  </div>
                  
                  <div className="flex justify-between pt-2">
                    <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm">
                      {language === 'pl' ? 'Poprzednie' : 'Previous'}
                    </button>
                    <div className="flex gap-3">
                      <button className="px-6 py-3 rounded-xl bg-primary/40 border border-primary/20 text-white font-bold text-sm">
                        {language === 'pl' ? 'Sprawdź' : 'Check'}
                      </button>
                      <button className="px-6 py-3 rounded-xl bg-primary text-black font-bold text-sm">
                        {language === 'pl' ? 'Dalej' : 'Next'}
                      </button>
                    </div>
                  </div>
                </div>
              </MockupWindow>
            </div>
            
            {/* Divider */}
            <div className="col-span-1 lg:col-span-2 py-8">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>

            {/* Feature 2: Detailed AI Analysis */}
            <div className="relative order-2 lg:order-1">
              <MockupWindow title={language === 'pl' ? 'Szczegółowa analiza AI' : 'Detailed AI Analysis'}>
                <div className="space-y-4">
                  <h4 className="text-white font-bold border-b border-white/10 pb-4 mb-4">
                    {language === 'pl' ? 'Szczegółowa analiza każdego zdania' : 'Detailed analysis for each sentence'}
                  </h4>
                  
                  <div className="bg-black/30 border border-white/5 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="bg-white/5 px-2 py-1 rounded text-xs text-content-muted font-mono">Zdanie 1</span>
                        <div className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full">
                          <Sparkles size={12} /> {language === 'pl' ? 'Sprawdzone przez: OpenAI' : 'Verified by: OpenAI'}
                        </div>
                      </div>
                      <div className="text-primary font-black flex items-center gap-1">
                        100% <CheckCircle2 size={16} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-content-muted uppercase tracking-widest mb-1">{language === 'pl' ? 'Znaczenie' : 'Meaning'}</div>
                        <div className="text-white font-bold font-mono">40/40</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-content-muted uppercase tracking-widest mb-1">{language === 'pl' ? 'Gramatyka' : 'Grammar'}</div>
                        <div className="text-white font-bold font-mono">40/40</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-content-muted uppercase tracking-widest mb-1">{language === 'pl' ? 'Słownictwo' : 'Vocabulary'}</div>
                        <div className="text-white font-bold font-mono">20/20</div>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <div className="text-[10px] text-content-muted uppercase tracking-widest mb-1">{language === 'pl' ? 'Twoja odpowiedź' : 'Your answer'}</div>
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-white text-sm">
                        I usually go to the gym after work.
                      </div>
                    </div>
                    
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2 text-blue-300 text-xs font-bold uppercase tracking-wider">
                        <Lightbulb size={14} /> {language === 'pl' ? 'Sprawdź Feedback' : 'Check Feedback'}
                      </div>
                      <p className="text-content-muted text-sm">
                        {language === 'pl' ? 'Tłumaczenie jest poprawne i oddaje zamierzony sens.' : 'The translation is correct and captures the intended meaning.'}
                      </p>
                    </div>
                  </div>
                </div>
              </MockupWindow>
            </div>

            <div className="space-y-6 lg:pl-12 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-bold border border-blue-500/20">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                {language === 'pl' ? 'Bezkompromisowa ocena' : 'Uncompromising grading'}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {language === 'pl' ? 'AI rozkłada Twój błąd na czynniki pierwsze' : 'AI breaks down your mistakes'}
              </h3>
              <p className="text-content-muted text-lg">
                {language === 'pl' 
                  ? 'Zamiast prostego "źle/dobrze", silnik AI analizuje Twoje zdanie pod kątem znaczenia, gramatyki i słownictwa. Tłumaczy dlaczego dany zwrot jest niepoprawny, upewniając się, że nie popełnisz tego błędu ponownie.' 
                  : 'Instead of a simple "wrong/right", the AI engine analyzes your sentence for meaning, grammar, and vocabulary. It explains why a phrase is incorrect, ensuring you never make the same mistake twice.'}
              </p>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
