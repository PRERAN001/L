import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  try {
    const { activeTheme } = useTheme();
    if (hasHydrated) {
      return activeTheme;
    }
    return 'light';
  } catch (e) {
    const colorScheme = useRNColorScheme();
    if (hasHydrated) {
      return colorScheme;
    }
    return 'light';
  }
}
