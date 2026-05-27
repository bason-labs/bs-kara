export const DarkColors = {
  bg: '#06100f',
  surface: '#0e1c1c',
  surface2: '#152a2a',
  border: '#1f3a3a',
  fg: '#e0ffff',
  muted: '#7aa8a8',
  brand: '#008b8b',
  brand2: '#006d6f',
  accent: '#40e0d0',
  glow: '#7df9ff',
  danger: '#ff5f6d',
  gradientStart: '#008b8b',
  gradientMid: '#006d6f',
  gradientEnd: '#0d98ba',
} as const;

export const LightColors = {
  bg: '#f7f8fa',
  surface: '#ffffff',
  surface2: '#eef1f3',
  border: '#dde3e8',
  fg: '#0d1a1a',
  muted: '#4a7070',
  brand: '#006d6f',
  brand2: '#005557',
  accent: '#006d6f',
  glow: '#008b8b',
  danger: '#d93025',
  gradientStart: '#006d6f',
  gradientMid: '#005557',
  gradientEnd: '#0d98ba',
} as const;

export type ColorTokens = typeof DarkColors;
