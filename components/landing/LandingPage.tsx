
import React, { useState, useEffect, useRef } from 'react';

import { Sparkles, Brain, Activity, Ear, Mail, ChevronRight, CheckCircle2, Star, Lightbulb, Play, Users, BookOpen, Settings, CheckSquare, PenTool, ArrowRight, GraduationCap, Trophy, Globe, Lock, Shield, ExternalLink, Code } from 'lucide-react';
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
      <div className="w-2.5 h-2.5 rounded-full bg-danger/80"></div>
      <div className="w-2.5 h-2.5 rounded-full bg-warn/80"></div>
      <div className="w-2.5 h-2.5 rounded-full bg-primary/80"></div>
      {title && <span className="ml-2 text-[10px] font-mono text-white/30 uppercase">{title}</span>}
    </div>
    <div className="p-4 sm:p-6 bg-ink-2">
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
                  <path d="M28 10 A 15 15 0 1 0 28 30" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 23 23 A 8 8 0 1 1 23 11" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="23" cy="23" r="2.5" fill="var(--accent)" />
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
                    <button className="text-primary text-sm font-bold flex items-center justify-center gap-2 mx-auto hover:text-primary">
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
                      <button className="px-6 py-3 rounded-xl bg-primary/40 border border-primary/20 text-primary font-bold text-sm">
                        {language === 'pl' ? 'Sprawdź' : 'Check'}
                      </button>
                      <button className="px-6 py-3 rounded-xl bg-primary text-accent-ink font-bold text-sm">
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
                        <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">
                          <Sparkles size={12} /> {language === 'pl' ? 'Sprawdzone przez: Asystent AI' : 'Verified by: AI Assistant'}
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
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-primary text-sm">
                        I usually go to the gym after work.
                      </div>
                    </div>
                    
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2 text-primary text-xs font-bold uppercase tracking-wider">
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
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
            

            {/* Divider */}
            <div className="col-span-1 lg:col-span-2 py-16">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
              <div className="text-center mt-8">
                <span className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                  {language === 'pl' ? 'Dla Nauczycieli' : 'For Teachers'}
                </span>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mt-4 mb-4">
                  {language === 'pl' ? 'Pełnooperacyjne narzędzie do zarządzania kursantami' : 'Full-scale student management tool'}
                </h2>
                <p className="text-content-muted max-w-3xl mx-auto text-lg">
                  {language === 'pl' 
                    ? 'Stworzone dla freelancerów i tutorów języka angielskiego (wkrótce również innych języków). Zarządzaj uczniami, przydzielaj zadania i śledź ich postępy w jednym miejscu.' 
                    : 'Built for English language freelancers and tutors (soon other languages too). Manage students, assign tasks, and track progress all in one place.'}
                </p>
              </div>
            </div>

            {/* Tutor Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 col-span-1 lg:col-span-2">
              <div className="liquid-glass-card p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <Users className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{language === 'pl' ? 'Zarządzanie Kursantami' : 'Student Management'}</h3>
                <p className="text-content-muted text-sm">{language === 'pl' ? 'Pełna lista uczniów z podglądem ich aktywności, historii lekcji i ogólnych postępów.' : 'Full list of students with an overview of their activity, lesson history, and overall progress.'}</p>
              </div>
              <div className="liquid-glass-card p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <BookOpen className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{language === 'pl' ? 'Zestawy i Lekcje' : 'Sets & Lessons'}</h3>
                <p className="text-content-muted text-sm">{language === 'pl' ? 'Twórz i przypisuj konkretne zestawy słownictwa oraz całe historie lekcji bezpośrednio do profili uczniów.' : 'Create and assign specific vocabulary sets and full lesson histories directly to student profiles.'}</p>
              </div>
              <div className="liquid-glass-card p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <CheckSquare className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{language === 'pl' ? 'Prace Domowe i Testy' : 'Homework & Tests'}</h3>
                <p className="text-content-muted text-sm">{language === 'pl' ? 'Zlecaj prace domowe i testy z dokładnymi terminami wykonania, aby skutecznie weryfikować wiedzę.' : 'Assign homework and tests with exact deadlines to effectively verify knowledge.'}</p>
              </div>
            </div>

            {/* Tutor Mockup */}
            <div className="mt-8 col-span-1 lg:col-span-2">
              <MockupWindow title={language === 'pl' ? 'Panel Nauczyciela' : 'Teacher Dashboard'}>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
                    <h4 className="text-lg font-bold text-white">{language === 'pl' ? 'Podgląd Ucznia: Jan Kowalski' : 'Student Overview: John Doe'}</h4>
                    <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/30">Poziom: B2</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <h5 className="text-sm text-content-muted font-bold uppercase tracking-widest mb-3">{language === 'pl' ? 'Ostatnie Zadania' : 'Recent Tasks'}</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                          <span className="text-content">Test: Present Perfect</span>
                          <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">92%</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                          <span className="text-content">Praca domowa (Lekcja 4)</span>
                          <span className="text-warn font-bold bg-warn/10 px-2 py-0.5 rounded">W trakcie</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <h5 className="text-sm text-content-muted font-bold uppercase tracking-widest mb-3">{language === 'pl' ? 'Szybkie Akcje' : 'Quick Actions'}</h5>
                      <div className="space-y-2">
                        <button className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 p-2.5 rounded-lg text-sm font-bold transition-colors">
                          + {language === 'pl' ? 'Przypisz zadanie' : 'Assign Task'}
                        </button>
                        <button className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 p-2.5 rounded-lg text-sm transition-colors">
                          {language === 'pl' ? 'Wyślij zestaw słówek' : 'Send Vocab Set'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </MockupWindow>
            </div>

            {/* Divider */}
            <div className="col-span-1 lg:col-span-2 py-16">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-info/50 to-transparent"></div>
              <div className="text-center mt-8">
                <span className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                  {language === 'pl' ? 'Dla Ucznia' : 'For Students'}
                </span>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mt-4 mb-4">
                  {language === 'pl' ? 'Twój osobisty asystent nauki' : 'Your personal study assistant'}
                </h2>
              </div>
            </div>

            {/* Student Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 col-span-1 lg:col-span-2">
              <div className="flex gap-4 p-6 liquid-glass-card items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex-shrink-0 flex items-center justify-center text-primary border border-primary/30">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-1">{language === 'pl' ? 'Inteligentne Powtórki' : 'Spaced Repetition'}</h4>
                  <p className="text-content-muted text-sm">{language === 'pl' ? 'System przypomina słówka w idealnym momencie, aby na zawsze zapisały się w Twojej pamięci długotrwałej.' : 'The system reminds you of words at the perfect time so they stick in your long-term memory.'}</p>
                </div>
              </div>
              <div className="flex gap-4 p-6 liquid-glass-card items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex-shrink-0 flex items-center justify-center text-primary border border-primary/30">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-1">{language === 'pl' ? 'Pełna Kontrola Treningu' : 'Full Training Control'}</h4>
                  <p className="text-content-muted text-sm">{language === 'pl' ? 'Twórz własne zestawy słówek i elastycznie decyduj, z ilu zdań ma składać się dana sesja treningowa.' : 'Create your own vocab sets and flexibly decide how many sentences each training session should have.'}</p>
                </div>
              </div>
              <div className="flex gap-4 p-6 liquid-glass-card items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex-shrink-0 flex items-center justify-center text-primary border border-primary/30">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-1">{language === 'pl' ? 'Zadania od Lektora' : 'Tutor Assignments'}</h4>
                  <p className="text-content-muted text-sm">{language === 'pl' ? 'Otrzymuj i wykonuj prace domowe oraz dedykowane testy bezpośrednio z pulpitu Twojego konta.' : 'Receive and complete homework and dedicated tests directly from your dashboard.'}</p>
                </div>
              </div>
            </div>

            {/* Divider separating app info and creator section */}
            <div className="col-span-1 lg:col-span-2 pt-16 pb-10">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
              <div className="text-center mt-10">
                <span className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === 'pl' ? 'O Twórcy' : 'About the Creator'}
                </span>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mt-4 mb-3">
                  {language === 'pl' ? 'Twórca Projektu Cribro' : 'The Mind Behind Cribro'}
                </h2>
                <p className="text-content-muted text-sm md:text-base max-w-2xl mx-auto">
                  {language === 'pl' 
                    ? 'Innowacyjne podejście do nauki języków łączące sztuczną inteligencję z nowoczesnymi metodami zapamiętywania.' 
                    : 'An innovative approach to language learning combining artificial intelligence with modern memorization techniques.'}
                </p>
              </div>
            </div>

            {/* Creator Section: 2 Aligned Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 col-span-1 lg:col-span-2 pb-12 items-stretch">
              {/* Card 1: Bio & Photo Placeholder */}
              <div className="liquid-glass-card p-6 sm:p-8 border border-white/10 flex flex-col justify-between group relative overflow-hidden rounded-2xl shadow-xl h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                
                <div>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
                    {/* Waist-up Business Portrait Placeholder */}
                    <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-all duration-300 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex-shrink-0 bg-base-300/50">
                      <img 
                        src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&auto=format&fit=crop&q=80" 
                        alt="Maciej Wyrozumski - Twórca Cribro" 
                        className="w-full h-full object-cover object-top filter brightness-95 group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs py-0.5 text-center text-[10px] text-primary font-mono tracking-wider border-t border-primary/20">
                        {language === 'pl' ? 'Zdjęcie twórcy' : 'Creator photo'}
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-primary font-mono uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 mb-2">
                        <Code className="w-3 h-3" />
                        {language === 'pl' ? 'Twórca & Architekt Platformy' : 'Creator & Platform Architect'}
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-1">Maciej Wyrozumski</h3>
                      <p className="text-xs text-primary/80 font-medium">
                        {language === 'pl' ? 'Software Engineer • AI Solutions Specialist' : 'Software Engineer • AI Solutions Specialist'}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-content-muted leading-relaxed mb-6">
                    {language === 'pl' 
                      ? 'Pasjonat łączenia inżynierii oprogramowania i generatywnego AI z praktyczną edukacją. Stworzyłem platformę Cribro jako kompleksowe środowisko przyspieszające opanowywanie języka obcego – eliminujące rutynę i wspierające zarówno samodzielnych uczniów, jak i lektorów w codziennym procesie dydaktycznym.'
                      : 'Passionate about bridging software engineering and generative AI with practical education. I developed Cribro as a comprehensive platform to accelerate language acquisition—removing friction and empowering both independent learners and teachers in the daily educational process.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-content text-xs font-medium">
                    ⚡ AI & Large Language Models
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-content text-xs font-medium">
                    🧠 Spaced Repetition (SM-2)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-content text-xs font-medium">
                    🎯 EdTech & Modern Web
                  </span>
                </div>
              </div>

              {/* Card 2: Portfolio, Contact & Collaboration Tile */}
              <div className="liquid-glass-card p-6 sm:p-8 border border-white/10 flex flex-col justify-between group relative overflow-hidden rounded-2xl shadow-xl h-full">
                <div className="absolute inset-0 bg-gradient-to-bl from-info/5 via-transparent to-transparent pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <Globe className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] text-primary font-mono uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                      {language === 'pl' ? 'Portfolio & Projekty' : 'Portfolio & Projects'}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3">
                    {language === 'pl' ? 'Poznaj więcej moich projektów' : 'Discover more of my projects'}
                  </h3>

                  <p className="text-sm text-content-muted leading-relaxed mb-6">
                    {language === 'pl'
                      ? 'Odwiedź moje oficjalne portfolio, aby poznać inne autorskie narzędzia cyfrowe, zaawansowane aplikacje webowe oraz innowacje oparte o sztuczną inteligencję. Chętnie podejmę dyskusję o rozwoju nowych projektów i współpracy technologicznej.'
                      : 'Visit my official portfolio to explore other digital products, advanced web applications, and AI-driven innovations. Open for discussions regarding new projects and technical collaboration.'}
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <a 
                    href="https://www.maciej.pro" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full px-6 py-3.5 rounded-xl bg-primary text-accent-ink hover:bg-primary-hover font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 group/link"
                  >
                    <Globe className="w-4 h-4 group-hover/link:rotate-12 transition-transform" />
                    <span>www.maciej.pro</span>
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </a>

                  <a 
                    href="mailto:wyrozumski@maciej.pro" 
                    className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4 text-content-muted" />
                    <span>wyrozumski@maciej.pro</span>
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 bg-black/40 mt-auto z-10 relative">
        <div className="max-w-7xl mx-auto px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-content-muted text-sm text-center sm:text-left">
            &copy; {new Date().getFullYear()} Cribro. {language === 'pl' ? 'Wszelkie prawa zastrzeżone.' : 'All rights reserved.'}
          </div>
          <a href="mailto:wyrozumski@maciej.pro" className="flex items-center justify-center gap-2 text-content-muted hover:text-primary transition-colors text-sm bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/5">
            <Mail className="w-4 h-4" /> wyrozumski@maciej.pro
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
