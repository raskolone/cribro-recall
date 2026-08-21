import React, { createContext, useContext, useState, useEffect } from 'react';
import { SoundSettings, TTSAccent, VoiceGender, VoiceSpeed, SoundEngine } from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  ttsAccent: 'en-US',
  voiceGender: 'male',
  voiceSpeed: 1.0,
  soundEngine: 'auto',
  autoPlaySentence: true,
  autoPlayFlashcards: false,
  soundEffectsEnabled: true
};

interface SettingsContextType {
  showLearningProgressChart: boolean;
  setShowLearningProgressChart: (show: boolean) => void;
  soundSettings: SoundSettings;
  updateSoundSettings: (newSettings: Partial<SoundSettings>) => Promise<void>;
  resetSoundSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'cribro_sound_settings_v2';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showLearningProgressChart, setShowLearningProgressChartState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cribro_show_learning_progress_chart');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [soundSettings, setSoundSettingsState] = useState<SoundSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SOUND_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Error reading sound settings from localStorage:', e);
    }
    return DEFAULT_SOUND_SETTINGS;
  });

  // Sync settings with current logged-in user in Firestore
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.soundSettings) {
              const merged = { ...DEFAULT_SOUND_SETTINGS, ...userData.soundSettings };
              setSoundSettingsState(merged);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            } else if (userData.ttsAccent || userData.voiceGender || userData.voiceSpeed) {
              const legacyMerged: SoundSettings = {
                ...DEFAULT_SOUND_SETTINGS,
                ttsAccent: (userData.ttsAccent as TTSAccent) || DEFAULT_SOUND_SETTINGS.ttsAccent,
                voiceGender: (userData.voiceGender as VoiceGender) || DEFAULT_SOUND_SETTINGS.voiceGender,
                voiceSpeed: (userData.voiceSpeed as VoiceSpeed) || DEFAULT_SOUND_SETTINGS.voiceSpeed,
                soundEngine: (userData.soundEngine as SoundEngine) || DEFAULT_SOUND_SETTINGS.soundEngine,
                autoPlaySentence: userData.autoPlaySentence !== undefined ? userData.autoPlaySentence : DEFAULT_SOUND_SETTINGS.autoPlaySentence,
                autoPlayFlashcards: userData.autoPlayFlashcards !== undefined ? userData.autoPlayFlashcards : DEFAULT_SOUND_SETTINGS.autoPlayFlashcards
              };
              setSoundSettingsState(legacyMerged);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacyMerged));
            }
          }
        } catch (err) {
          console.warn('Could not fetch sound settings from Firestore:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const setShowLearningProgressChart = (show: boolean) => {
    setShowLearningProgressChartState(show);
    try {
      localStorage.setItem('cribro_show_learning_progress_chart', JSON.stringify(show));
    } catch {}
  };

  const updateSoundSettings = async (newSettings: Partial<SoundSettings>) => {
    const updated = { ...soundSettings, ...newSettings };
    setSoundSettingsState(updated);
    
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist sound settings to localStorage:', e);
    }

    if (auth.currentUser?.uid) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          soundSettings: updated,
          ttsAccent: updated.ttsAccent,
          voiceGender: updated.voiceGender,
          voiceSpeed: updated.voiceSpeed,
          soundEngine: updated.soundEngine,
          autoPlaySentence: updated.autoPlaySentence,
          autoPlayFlashcards: updated.autoPlayFlashcards
        });
      } catch (err) {
        console.warn('Failed to save sound settings to Firestore:', err);
      }
    }
  };

  const resetSoundSettings = async () => {
    await updateSoundSettings(DEFAULT_SOUND_SETTINGS);
  };

  return (
    <SettingsContext.Provider 
      value={{ 
        showLearningProgressChart, 
        setShowLearningProgressChart,
        soundSettings,
        updateSoundSettings,
        resetSoundSettings
      }}
    >
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
