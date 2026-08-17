import React from 'react';
import OnboardingOverlay from './OnboardingOverlay';
import { useLanguage } from '../../context/LanguageContext';

export const OnboardingTour: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { language } = useLanguage();
  return <OnboardingOverlay onComplete={onComplete} language={language} />;
};

export default OnboardingTour;
