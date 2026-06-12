import { createContext, useContext } from 'react';

export type TabBarVisibilityContextValue = {
  isHidden: boolean;
  setHidden: (hidden: boolean) => void;
};

export const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | undefined>(undefined);

export function useTabBarVisibility() {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error('useTabBarVisibility must be used within a TabBarVisibilityContext provider.');
  }
  return context;
}
