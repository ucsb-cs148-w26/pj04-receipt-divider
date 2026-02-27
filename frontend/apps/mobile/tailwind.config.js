/**
 * @type {import('tailwindcss/types/config').ResolvableTo<import('tailwindcss/types/config').RecursiveKeyValuePair<string, string>>}
 */
const colorExtentions = {
  // Semantic colors that auto-switch between light/dark mode
  background: 'var(--color-background)',
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  primary: 'var(--color-primary)',
  'primary-foreground': 'var(--color-primary-foreground)',
  border: 'var(--color-border)',
  muted: 'var(--color-muted)',
  'muted-foreground': 'var(--color-muted-foreground)',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
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
