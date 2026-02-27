/**
 * @type {import('tailwindcss/types/config').ResolvableTo<import('tailwindcss/types/config').RecursiveKeyValuePair<string, string>>}
 */
const colorExtentions = {
  // Core theme
  background: 'var(--color-background)',
  foreground: 'var(--color-foreground)',
  surface: 'var(--color-surface)',
  'surface-elevated': 'var(--color-surface-elevated)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',

  // Interactive
  primary: 'var(--color-primary)',
  'primary-foreground': 'var(--color-primary-foreground)',
  secondary: 'var(--color-secondary)',
  'secondary-foreground': 'var(--color-secondary-foreground)',

  // UI Elements
  border: 'var(--color-border)',
  'border-strong': 'var(--color-border-strong)',
  muted: 'var(--color-muted)',
  'muted-foreground': 'var(--color-muted-foreground)',

  // Feedback
  destructive: 'var(--color-destructive)',
  'destructive-foreground': 'var(--color-destructive-foreground)',
  success: 'var(--color-success)',
  'success-foreground': 'var(--color-success-foreground)',
  warning: 'var(--color-warning)',
  'warning-foreground': 'var(--color-warning-foreground)',

  // App-specific
  'amount-positive': 'var(--color-amount-positive)',
  'amount-negative': 'var(--color-amount-negative)',
  'receipt-bg': 'var(--color-receipt-background)',
  'item-bg': 'var(--color-item-background)',
  'item-selected': 'var(--color-item-selected)',
  'scan-overlay': 'var(--color-scan-overlay)',
  'scan-frame': 'var(--color-scan-frame)',

  // User avatars
  'avatar-1': 'var(--color-avatar-1)',
  'avatar-2': 'var(--color-avatar-2)',
  'avatar-3': 'var(--color-avatar-3)',
  'avatar-4': 'var(--color-avatar-4)',
  'avatar-5': 'var(--color-avatar-5)',
  'avatar-6': 'var(--color-avatar-6)',
  'avatar-7': 'var(--color-avatar-7)',
  'avatar-8': 'var(--color-avatar-8)',
  'avatar-9': 'var(--color-avatar-9)',
  'avatar-10': 'var(--color-avatar-10)',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    '../../shared/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: colorExtentions,
    },
  },
};
