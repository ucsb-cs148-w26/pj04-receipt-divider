/**
 * An array of tailwind color classes to be used for user avatars.
 *
 * Use `USER_COLORS[(userId-1) % USER_COLORS.length]` to get a color for a user index.
 */
export const USER_COLORS = [
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
  'avatar-6',
  'avatar-7',
  'avatar-8',
  'avatar-9',
  'avatar-10',
];

/**
 * Hex color values for each avatar slot — mirrors the CSS variables defined in global.css.
 *
 * Use `USER_COLOR_HEX[(userId-1) % USER_COLOR_HEX.length]` for inline styles.
 */
export const USER_COLOR_HEX = [
  '#3b82f6', // avatar-1  blue
  '#ef4444', // avatar-2  red
  '#22c55e', // avatar-3  green
  '#eab308', // avatar-4  yellow
  '#a855f7', // avatar-5  purple
  '#ec4899', // avatar-6  pink
  '#6366f1', // avatar-7  indigo
  '#f97316', // avatar-8  orange
  '#14b8a6', // avatar-9  teal
  '#06b6d4', // avatar-10 cyan
];
