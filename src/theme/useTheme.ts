import { useColorScheme } from 'react-native';
import { colors, codeTokens } from './tokens';

export type ColorScheme = 'light' | 'dark';

export function useThemeTokens() {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isDark = scheme === 'dark';
  return {
    scheme,
    isDark,
    colors: isDark ? colors.dark : colors,
    code: isDark ? codeTokens.dark : codeTokens.light,
  };
}