import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'pl' ? 'en' : 'pl';
    i18n.changeLanguage(nextLang);
    // Reload the page to ensure all strings handled via global `t` without hooks update properly
    window.location.reload();
  };

  return (
    <button 
      onClick={toggleLanguage}
      className="px-3 py-1.5 rounded-lg border border-white/10 bg-base-300 hover:bg-base-100 text-sm font-bold uppercase tracking-wider text-content transition-all"
    >
      {i18n.language === 'pl' ? 'PL / EN' : 'EN / PL'}
    </button>
  );
};
