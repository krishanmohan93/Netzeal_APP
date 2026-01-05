/**
 * Theme and styling constants
 */
export const colors = {
  // Light golden brand palette
  primary: '#C9A227',        // Gold
  primaryDark: '#9C7C1E',    // Dark gold
  primaryLight: '#E6C65B',   // Light gold
  secondary: '#F5E6A7',      // Soft sand

  // UI Colors
  background: '#FAF8F1',     // Warm off-white
  surface: '#FFFDF6',        // Very light surface
  card: '#FFFFFF',

  // Text Colors
  text: '#1E1C16',
  textSecondary: '#6E664E',  // Muted brown/olive
  textLight: '#9A9277',

  // Status Colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#D4AF37',        // Royal gold for warnings
  info: '#8C7D3A',           // Desaturated gold tone

  // Border and Divider
  border: '#E9E2C8',
  divider: '#EDE6CF',

  // Action Colors
  like: '#E85D5D',           // Softer red to fit palette
  comment: '#C9A227',        // Use brand gold
  bookmark: '#E6C65B',       // Light gold
  share: '#8C7D3A',          // Desaturated gold
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal',
    lineHeight: 16,
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};
