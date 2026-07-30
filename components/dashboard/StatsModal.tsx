import React from 'react';
import { GSAPModal } from '../ui/GSAPModal';
import ProgressOverview from './ProgressOverview';
import LearningProgressChart from './LearningProgressChart';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose }) => {
  const { showLearningProgressChart } = useSettings();
  const { language } = useLanguage();

  return (
    <GSAPModal isOpen={isOpen} onClose={onClose}>
      <div className="bg-base-100 p-6 rounded-2xl shadow-xl liquid-glass-card">
        <h2 className="text-xl font-bold mb-4">{language === 'pl' ? 'Statystyki' : 'Statistics'}</h2>
        <div className="space-y-6">
          <ProgressOverview />
          {showLearningProgressChart && <LearningProgressChart />}
        </div>
      </div>
    </GSAPModal>
  );
};

export default StatsModal;
