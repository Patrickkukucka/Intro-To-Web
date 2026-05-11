export const colors = {
  background: '#0D1B2A',
  surface: '#152535',
  card: '#1C3145',
  cardElevated: '#243D56',
  primary: '#2D6A4F',
  primaryLight: '#52B788',
  primaryDark: '#1B4332',
  accent: '#FFD166',
  accentOrange: '#F4845F',
  border: '#1E3A5F',
  borderLight: '#2A4D6E',

  text: '#E8F4F8',
  textSecondary: '#7B9CB5',
  textMuted: '#4A6A80',

  // Rarity
  common: '#52B788',
  uncommon: '#4A90D9',
  rare: '#9B5DE5',
  legendary: '#F4845F',

  // Status
  success: '#52B788',
  error: '#E05C5C',
  warning: '#FFD166',

  // Pro
  pro: '#FFD166',
  proGlow: 'rgba(255, 209, 102, 0.2)',

  // Overlays
  overlay: 'rgba(13, 27, 42, 0.85)',
  overlayLight: 'rgba(21, 37, 53, 0.7)',
  silhouette: '#0A1520',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  h4: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionBold: { fontSize: 12, fontWeight: '600' as const },
  tiny: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.5 },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  }),
};

export const rarityColors: Record<string, string> = {
  Common: colors.common,
  Uncommon: colors.uncommon,
  Rare: colors.rare,
  Legendary: colors.legendary,
};

export const rarityOrder: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Legendary: 3,
};
