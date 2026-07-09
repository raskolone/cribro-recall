import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  showLearningProgressChart: boolean;
  setShowLearningProgressChart: (show: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showLearningProgressChart, setShowLearningProgressChartState] = useState<boolean>(() => {
    const saved = localStorage.getItem('cribro_show_learning_progress_chart');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const setShowLearningProgressChart = (show: boolean) => {
    setShowLearningProgressChartState(show);
    localStorage.setItem('cribro_show_learning_progress_chart', JSON.stringify(show));
  };

  return (
    <SettingsContext.Provider value={{ showLearningProgressChart, setShowLearningProgressChart }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
