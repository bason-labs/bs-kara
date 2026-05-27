import { createContext, useContext } from 'react';

interface SettingsContextValue { openSettings: () => void; }

export const SettingsContext = createContext<SettingsContextValue>({ openSettings: () => {} });
SettingsContext.displayName = 'SettingsContext';

export function useSettingsContext(): SettingsContextValue {
  return useContext(SettingsContext);
}
