import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111214',
    textSecondary: '#5E626B',
    textTertiary: '#767A83',
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
    dotInactive: '#D1D1D6',
    dotPast: '#636366',
    switchOn: '#34C759',
    stopBorder: '#1C1C1E',
    success: '#1E7B3A',
    successTint: '#E8F5EC',
    warningTint: '#FFF4E0',
    warningText: '#8A5A00',
    accent: '#CF3B22',
    onAccent: '#FFFFFF',
    accentSoft: '#F8D3CB',
    accentTint: '#FCEAE5',
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
    raised: '#636366',
    onRaised: '#FFFFFF',
    inputFill: '#2C2C2E',
    inputBorder: '#48484A',
    stopFill: '#2C2C2E',
    onStop: '#FFFFFF',
    dotInactive: '#3A3A3C',
    dotPast: '#8E8E93',
    switchOn: '#30D158',
    stopBorder: '#636366',
    success: '#5FD38A',
    successTint: '#12301C',
    warningTint: '#3A2A0A',
    warningText: '#FFC56B',
    accent: '#FF6A4D',
    onAccent: '#000000',
    accentSoft: '#4A2018',
    accentTint: '#2E1510',
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
