export const COLORS = {
  // Primary palette
  primary: '#0a7ea4',
  secondary: '#687076',

  // Semantic
  error: '#FF3B30',
  success: '#4ade80',
  warning: '#fbbf24',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray: '#F0F0F0',
  transparent: 'transparent',
} as const;

export type ColorName = keyof typeof COLORS;
export type ColorValue = (typeof COLORS)[ColorName];
