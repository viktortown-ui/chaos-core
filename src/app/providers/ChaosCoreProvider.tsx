import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CoreDataV2, PathKey, StatKey } from '../../core/types';
import { t } from '../../shared/i18n';
import { loadCoreData, saveCoreData } from '../../core/storage';

interface ChaosCoreContextValue {
  data: CoreDataV2;
  setData: React.Dispatch<React.SetStateAction<CoreDataV2>>;
  toastMessage: string | null;
  clearToast: () => void;
  completeOnboarding: (path?: PathKey, focusStat?: StatKey) => void;
}

const ChaosCoreContext = createContext<ChaosCoreContextValue | undefined>(undefined);

export function ChaosCoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CoreDataV2>(() => loadCoreData());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    saveCoreData(data);
  }, [data]);

  const completeOnboarding = (path?: PathKey, focusStat?: StatKey) => {
    setData((current) => ({
      ...current,
      onboarding: {
        ...current.onboarding,
        completedAt: new Date().toISOString(),
        version: 1
      },
      profile: {
        ...current.profile,
        path,
        focusStat
      }
    }));
    setToastMessage(t('toastCoreInitialized', data.settings.language));
  };

  return (
    <ChaosCoreContext.Provider value={{ data, setData, toastMessage, clearToast: () => setToastMessage(null), completeOnboarding }}>
      {children}
    </ChaosCoreContext.Provider>
  );
}

export function useChaosCore(): ChaosCoreContextValue {
  const context = useContext(ChaosCoreContext);
  if (!context) throw new Error('useChaosCore must be used inside ChaosCoreProvider');
  return context;
}
