import React from 'react';
import Card from '../ui/Card';
import { useLanguage } from '../../context/LanguageContext';

const AIExerciseGeneratorScreen: React.FC = () => {
  const { language } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">
        {language === 'pl' ? 'Generator Ćwiczeń AI' : 'AI Exercise Generator'}
      </h1>
      <Card className="p-8 text-center flex flex-col items-center justify-center border border-primary/20 shadow-xl bg-primary/5 min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <span className="text-3xl">✨</span>
        </div>
        <h2 className="text-2xl font-bold mb-4">
          {language === 'pl' ? 'Twoje Osobiste Laboratorium Językowe' : 'Your Personal Language Lab'}
        </h2>
        <p className="text-content-muted max-w-md mx-auto mb-8">
          {language === 'pl' 
            ? 'Wybierz zestaw słówek, a sztuczna inteligencja przygotuje dla Ciebie spersonalizowane ćwiczenia: krótkie teksty, dialogi do uzupełnienia lub testy wyboru bazujące na Twoim słownictwie.' 
            : 'Select a word set and our AI will generate personalized exercises: short stories, fill-in-the-blank dialogues, or multiple choice quizzes based on your vocabulary.'}
        </p>
        <div className="inline-flex items-center justify-center px-6 py-3 border-2 border-dashed border-primary/50 rounded-lg text-primary font-bold bg-primary/10">
          {language === 'pl' ? 'Niebawem Dostępne (Work in Progress)' : 'Coming Soon (Work in Progress)'}
        </div>
      </Card>
    </div>
  );
};

export default AIExerciseGeneratorScreen;
