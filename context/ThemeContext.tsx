import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = 'light' | 'dark' | 'adaptive';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isAdaptive: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Zwraca motyw na podstawie aktualnej godziny:
 * - Dzień (07:00 – 19:00): tryb jasny o błękitnym, świeżym odcieniu
 * - Noc (19:00 – 07:00): tryb ciemny (Nocturne Green)
 */
export const getAdaptiveTheme = (): Theme => {
  try {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const savedMode = localStorage.getItem('theme_mode');
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'adaptive') {
        return savedMode as ThemeMode;
      }
      const legacyTheme = localStorage.getItem('theme');
      if (legacyTheme === 'light' || legacyTheme === 'dark') {
        return legacyTheme as ThemeMode;
      }
    } catch {}
    return 'adaptive';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    if (themeMode === 'adaptive') {
      return getAdaptiveTheme();
    }
    return themeMode;
  });

  // Reakcja na zmianę trybu lub upływ czasu w trybie adaptacyjnym
  useEffect(() => {
    const updateTheme = () => {
      if (themeMode === 'adaptive') {
        const currentAdaptive = getAdaptiveTheme();
        setThemeState(currentAdaptive);
      } else {
        setThemeState(themeMode);
      }
    };

    updateTheme();

    if (themeMode === 'adaptive') {
      const interval = setInterval(updateTheme, 60000); // sprawdzaj co minutę
      return () => clearInterval(interval);
    }
  }, [themeMode]);

  // Synchronizacja z DOM (klasy, atrybuty i style)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    try {
      localStorage.setItem('theme', theme);
      localStorage.setItem('theme_mode', themeMode);
    } catch {}
  }, [theme, themeMode]);

  const toggleTheme = () => {
    if (themeMode === 'adaptive') {
      // Przejście z adaptacyjnego na jawny przeciwny do aktualnego
      const nextTheme = theme === 'light' ? 'dark' : 'light';
      setThemeModeState(nextTheme);
    } else {
      setThemeModeState(prev => (prev === 'light' ? 'dark' : 'light'));
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeModeState(newTheme);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isAdaptive: themeMode === 'adaptive',
        toggleTheme,
        setTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
