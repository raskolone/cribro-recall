import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

type Language = 'pl' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    'nav.creator': 'About Creator',
    'hero.subtitle': 'less noise. more language.',
    'hero.title': 'CRIBRO ENGLISH',
    'hero.start': 'Start Learning Now',
    'about.title': 'About App',
    'about.word1': 'Generator.',
    'about.word2': 'Coach.',
    'about.word3': 'Assistant.',
    'about.desc': 'CRIBRO ENGLISH is a modern tool for learning English. It uses artificial intelligence to generate vocabulary tailored to your level, offers interactive exercises, and a spaced repetition system.',
    'stats.title': 'Statistics',
    'stats.languages': 'Foreign Languages',
    'stats.words': 'Generated Words',
    'stats.modes': 'Learning Modes',
    'flashcards.title': 'My Word Lists',
    'flashcards.create': 'Create New Set',
    'flashcards.setTitle': 'Title',
    'flashcards.setDesc': 'Description (Optional)',
    'flashcards.createBtn': 'Create Set',
    'flashcards.study': 'Study',
    'flashcards.edit': 'Edit',
    'flashcards.delete': 'Delete',
    'flashcards.empty': 'You don\'t have any flashcard sets yet. Create one above!',
    'flashcards.cards': 'cards',
    'flashcards.back': 'Back to Sets',
    'flashcards.save': 'Save Changes',
    'flashcards.addCard': 'Add Card',
    'flashcards.term': 'Term',
    'flashcards.definition': 'Definition',
    'flashcards.remove': 'Remove',
    'flashcards.quit': 'Quit',
    'flashcards.incorrect': 'Incorrect',
    'flashcards.correct': 'Correct',
    'flashcards.clickReveal': 'Click the card to reveal the answer',
    'flashcards.complete': 'Session Complete!',
    'flashcards.score': 'You got {correct} out of {total} correct.',
    'flashcards.emptySet': 'This set has no cards.',
  },
  pl: {
    'nav.creator': 'O Twórcy Aplikacji',
    'hero.subtitle': 'less noise. more language.',
    'hero.title': 'CRIBRO ENGLISH',
    'hero.start': 'Zacznij Naukę Teraz',
    'about.title': 'O Aplikacji',
    'about.word1': 'Generator.',
    'about.word2': 'Trener.',
    'about.word3': 'Asystent.',
    'about.desc': 'CRIBRO ENGLISH to nowoczesne narzędzie do nauki języka angielskiego. Wykorzystuje sztuczną inteligencję do generowania słownictwa dopasowanego do Twojego poziomu, oferuje interaktywne ćwiczenia i system powtórek.',
    'stats.title': 'Statystyki',
    'stats.languages': 'Języki obce',
    'stats.words': 'Wygenerowanych słów',
    'stats.modes': 'Tryby nauki',
    'flashcards.title': 'Moje Listy Słów (My Word Lists)',
    'flashcards.create': 'Utwórz Nowy Zestaw',
    'flashcards.setTitle': 'Tytuł',
    'flashcards.setDesc': 'Opis (Opcjonalnie)',
    'flashcards.createBtn': 'Utwórz Zestaw',
    'flashcards.study': 'Ucz się',
    'flashcards.edit': 'Edytuj',
    'flashcards.delete': 'Usuń',
    'flashcards.empty': 'Nie masz jeszcze żadnych zestawów fiszek. Utwórz jeden powyżej!',
    'flashcards.cards': 'fiszek',
    'flashcards.back': 'Wróć do Zestawów',
    'flashcards.save': 'Zapisz Zmiany',
    'flashcards.addCard': 'Dodaj Fiszkę',
    'flashcards.term': 'Pojęcie',
    'flashcards.definition': 'Definicja',
    'flashcards.remove': 'Usuń',
    'flashcards.quit': 'Zakończ',
    'flashcards.incorrect': 'Źle',
    'flashcards.correct': 'Dobrze',
    'flashcards.clickReveal': 'Kliknij fiszkę, aby odkryć odpowiedź',
    'flashcards.complete': 'Sesja Zakończona!',
    'flashcards.score': 'Masz {correct} z {total} poprawnych odpowiedzi.',
    'flashcards.emptySet': 'Ten zestaw nie ma fiszek.',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

import i18n from '../i18n';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pl');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang && (savedLang === 'pl' || savedLang === 'en')) {
      setLanguage(savedLang);
      i18n.changeLanguage(savedLang);
    } else {
      const browserLang = navigator.language.startsWith('pl') ? 'pl' : 'en';
      setLanguage(browserLang);
      i18n.changeLanguage(browserLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
    i18n.changeLanguage(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || i18n.t(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      <div key={language} style={{ display: 'contents' }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
