import { useMemo } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccent } from '@/theme/accent-store';
import { accentPalettes } from '@/theme/accents';

export function useTheme() {
  const scheme = useColorScheme();
  const accent = useAccent();
  const mode = scheme === 'dark' ? 'dark' : 'light';

  return useMemo(() => ({ ...Colors[mode], ...accentPalettes[accent][mode] }), [mode, accent]);
}
