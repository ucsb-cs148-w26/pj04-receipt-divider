import { COLORS } from '../constants/colors';

export const lightTheme = {
  dark: false,
  colors: {
    primary: COLORS.primary,
    background: '#FFFFFF',
    card: '#F5F5F5',
    text: '#000000',
    border: '#E0E0E0',
    notification: COLORS.error,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '600' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900' as const,
    },
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    primary: COLORS.primary,
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    border: '#333333',
    notification: COLORS.error,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '600' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900' as const,
    },
  },
};
