import { createContext, useContext, useState, ReactNode } from 'react';

interface PreferencesContextType {
  fallbackPrefs: {
    selectedTopicIds: bigint[];
    selectedLanguageIds: bigint[];
  } | null;
  setFallbackPrefs: (prefs: { selectedTopicIds: bigint[]; selectedLanguageIds: bigint[] }) => void;
  isFallbackActive: boolean;
  setFallbackActive: (active: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [fallbackPrefs, setFallbackPrefs] = useState<{ selectedTopicIds: bigint[]; selectedLanguageIds: bigint[] } | null>(null);
  const [isFallbackActive, setFallbackActive] = useState(false);

  return (
    <PreferencesContext.Provider value={{
      fallbackPrefs,
      setFallbackPrefs,
      isFallbackActive,
      setFallbackActive
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};