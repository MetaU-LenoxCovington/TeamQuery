import { COLORS } from './colors';

export const ERROR_MESSAGE_STYLES = {
  container: `p-4 rounded-lg bg-[${COLORS.dustyRose}]/10 border border-[${COLORS.dustyRose}]`,
  text: `text-sm text-[${COLORS.apricot}] font-medium`,
  inline: `mt-2 text-sm text-[${COLORS.apricot}] font-medium`,
} as const;

export const SUCCESS_MESSAGE_STYLES = {
  container: `p-4 rounded-lg bg-[${COLORS.mint}]/10 border border-[${COLORS.mint}]`,
  text: `text-sm text-[${COLORS.forestGreen}] font-medium`,
  inline: `mt-2 text-sm text-[${COLORS.forestGreen}] font-medium`,
} as const;

export const LOADING_STYLES = {
  spinner: `animate-spin rounded-full border-2 border-current border-t-transparent`,
  spinnerSizes: {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  },
  container: 'flex items-center justify-center py-4',
  text: `ml-2 text-sm text-[${COLORS.lavender}]`,
  overlay: 'opacity-70',
} as const;

export const INFO_MESSAGE_STYLES = {
  container: `p-4 rounded-lg bg-[${COLORS.palePurple}]/10 border border-[${COLORS.palePurple}]`,
  text: `text-sm text-[${COLORS.lavender}] font-medium`,
  helper: `mt-1 text-xs text-[${COLORS.lavender}]`,
} as const;

export type LoadingSize = keyof typeof LOADING_STYLES.spinnerSizes;
