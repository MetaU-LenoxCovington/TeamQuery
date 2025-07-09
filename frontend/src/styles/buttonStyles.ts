import { COLORS } from './colors';

export const BUTTON_BASE_CLASSES = `
  px-6 py-3 rounded-lg font-medium font-['Tiempos'] transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-offset-2
  disabled:cursor-not-allowed disabled:opacity-60
  flex items-center justify-center gap-2
`;

export const BUTTON_VARIANTS = {
  primary: `
    bg-[${COLORS.forestGreen}] text-white hover:bg-[${COLORS.forestGreen}]/90
    focus:ring-[${COLORS.forestGreen}]/50 active:bg-[${COLORS.forestGreen}]/95
    disabled:bg-[${COLORS.forestGreen}]/50
  `,
  secondary: `
    bg-[${COLORS.lavender}] text-white hover:bg-[${COLORS.lavender}]/90
    focus:ring-[${COLORS.lavender}]/50 active:bg-[${COLORS.lavender}]/95
    disabled:bg-[${COLORS.lavender}]/50
  `,
  outline: `
    bg-transparent text-[${COLORS.forestGreen}] border-2 border-[${COLORS.forestGreen}]
    hover:bg-[${COLORS.forestGreen}]/5 focus:ring-[${COLORS.forestGreen}]/50
    active:bg-[${COLORS.forestGreen}]/10 disabled:border-[${COLORS.forestGreen}]/50
    disabled:text-[${COLORS.forestGreen}]/50
  `
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
