import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CoreDataV1 } from '../core/types';
import { loadCoreData, saveCoreData } from '../core/storage';

interface ChaosCoreContextValue {
  data: CoreDataV1;
  setData: React.Dispatch<React.SetStateAction<CoreDataV1>>;
}

const ChaosCoreContext = createContext<ChaosCoreContextValue | undefined>(undefined);

export function ChaosCoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CoreDataV1>(() => loadCoreData());

  useEffect(() => {
    saveCoreData(data);
  }, [data]);

  return <ChaosCoreContext.Provider value={{ data, setData }}>{children}</ChaosCoreContext.Provider>;
}

export function useChaosCore(): ChaosCoreContextValue {
  const context = useContext(ChaosCoreContext);
  if (!context) throw new Error('useChaosCore must be used inside ChaosCoreProvider');
  return context;
}
