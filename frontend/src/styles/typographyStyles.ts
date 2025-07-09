import { COLORS } from './colors';

export const TYPOGRAPHY_STYLES = {
  headings: {
    h1: `text-3xl font-bold text-[${COLORS.charcoal}] font-['Tiempos']`,
    h2: `text-2xl font-bold text-[${COLORS.charcoal}] font-['Tiempos']`,
    h3: `text-xl font-semibold text-[${COLORS.charcoal}] font-['Tiempos']`,
    h4: `text-lg font-semibold text-[${COLORS.charcoal}] font-['Tiempos']`,
  },
  body: {
    large: `text-base text-[${COLORS.charcoal}] font-['Tiempos']`,
    base: `text-sm text-[${COLORS.charcoal}] font-['Tiempos']`,
    small: `text-xs text-[${COLORS.charcoal}] font-['Tiempos']`,
  },
  secondary: {
    large: `text-base text-[${COLORS.lavender}]`,
    base: `text-sm text-[${COLORS.lavender}]`,
    small: `text-xs text-[${COLORS.lavender}]`,
  },
  interactive: {
    link: `text-[${COLORS.forestGreen}] font-medium hover:text-[${COLORS.forestGreen}]/80 transition-colors`,
    linkDisabled: `text-[${COLORS.forestGreen}] font-medium opacity-60 cursor-not-allowed`,
  },
  spacing: {
    tight: 'mb-1',
    normal: 'mb-2',
    relaxed: 'mb-4',
    loose: 'mb-8',
  }
} as const;

export type HeadingLevel = keyof typeof TYPOGRAPHY_STYLES.headings;
export type BodySize = keyof typeof TYPOGRAPHY_STYLES.body;
export type SecondarySize = keyof typeof TYPOGRAPHY_STYLES.secondary;
export type TypographySpacing = keyof typeof TYPOGRAPHY_STYLES.spacing;
