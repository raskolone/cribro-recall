import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import pl from './pl.json';

let savedLang = 'pl';
try {
  savedLang = localStorage.getItem('app_language') || 'pl';
} catch (e) {
  console.warn('localStorage access denied, falling back to default language');
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pl: { translation: pl }
    },
    lng: savedLang,
    fallbackLng: 'pl',
    interpolation: {
      escapeValue: false
    }
  });

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('app_language', lng);
  } catch (e) {
    console.warn('localStorage access denied');
  }
});

export default i18n;
