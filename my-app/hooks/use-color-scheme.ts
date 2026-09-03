import { useColorScheme as useRNColorScheme } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function useColorScheme() {
  try {
    const { activeTheme } = useTheme();
    return activeTheme;
  } catch (e) {
    return useRNColorScheme();
  }
}
