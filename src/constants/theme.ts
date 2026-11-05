import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111214',
    textSecondary: '#5E626B',
    textTertiary: '#8B8F98',
    background: '#FFFFFF',
    backgroundElement: '#F2F2F4',
    backgroundSelected: '#E4E4E8',
    border: '#E4E4E8',
    accent: '#CF3B22',
    onAccent: '#FFFFFF',
    accentSoft: '#F8D3CB',
    accentTint: '#FCEAE5',
    inverse: '#111214',
    onInverse: '#FFFFFF',
    danger: '#C42B1C',
    warning: '#E59A0B',
  },
  dark: {
    text: '#F4F4F5',
    textSecondary: '#A8ACB3',
    textTertiary: '#70747C',
    background: '#000000',
    backgroundElement: '#1A1B1E',
    backgroundSelected: '#2A2C30',
    border: '#26282C',
    accent: '#FF6A4D',
    onAccent: '#000000',
    accentSoft: '#4A2018',
    accentTint: '#2E1510',
    inverse: '#F4F4F5',
    onInverse: '#000000',
    danger: '#FF7A6B',
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
