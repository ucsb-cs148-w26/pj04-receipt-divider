import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { COLORS } from '../constants/colors';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    error: COLORS.error,
    tertiary: COLORS.warning,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    error: COLORS.error,
    tertiary: COLORS.warning,
  },
};

export const appTheme = lightTheme;
