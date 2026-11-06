import '@/global.css';

import { Platform } from 'react-native';

import { accentPalettes } from '@/theme/accents';

export const Colors = {
  light: {
    text: '#111214',
    textSecondary: '#5E626B',
    textTertiary: '#6B6F78',
    background: '#FFFFFF',
    backgroundElement: '#F2F2F4',
    backgroundSelected: '#E4E4E8',
    border: '#E4E4E8',
    raised: '#FFFFFF',
    onRaised: '#111214',
    inputFill: '#FFFFFF',
    inputBorder: '#D1D1D6',
    stopFill: '#1C1C1E',
    onStop: '#FFFFFF',
    dotInactive: '#C7C7CC',
    dotPast: '#C7C7CC',
    switchOn: '#34C759',
    stopBorder: '#1C1C1E',
    success: '#1E7B3A',
    successTint: '#E8F5EC',
    warningTint: '#FFF4E0',
    warningText: '#8A5A00',
    ...accentPalettes.red.light,
    inverse: '#111214',
    onInverse: '#FFFFFF',
    danger: '#B3261E',
    warning: '#E59A0B',
  },
  dark: {
    text: '#F4F4F5',
    textSecondary: '#A8ACB3',
    textTertiary: '#8A8E96',
    background: '#000000',
    backgroundElement: '#1A1B1E',
    backgroundSelected: '#2A2C30',
    border: '#26282C',
    raised: '#48484A',
    onRaised: '#FFFFFF',
    inputFill: '#2C2C2E',
    inputBorder: '#48484A',
    stopFill: '#F2F2F7',
    onStop: '#000000',
    dotInactive: '#545458',
    dotPast: '#545458',
    switchOn: '#30D158',
    stopBorder: '#F2F2F7',
    success: '#5FD38A',
    successTint: '#12301C',
    warningTint: '#3A2A0A',
    warningText: '#FFC56B',
    ...accentPalettes.red.dark,
    inverse: '#F4F4F5',
    onInverse: '#000000',
    danger: '#FF8A80',
    warning: '#F5A524',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  web: {
    display: 'Archivo, ui-sans-serif, system-ui, sans-serif',
    condensed: '"Archivo Narrow", Archivo, ui-sans-serif, system-ui, sans-serif',
    body: 'Figtree, ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  ios: {
    display: 'system-ui',
    condensed: 'system-ui',
    body: 'system-ui',
    mono: 'ui-monospace',
  },
  default: {
    display: 'sans-serif',
    condensed: 'sans-serif-condensed',
    body: 'sans-serif',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const ControlHeight = {
  small: 36,
  regular: 48,
  large: 56,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 640;
