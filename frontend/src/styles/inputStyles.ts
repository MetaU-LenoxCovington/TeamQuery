import { COLORS } from './colors';

export const INPUT_BASE_CLASSES = `
  w-full px-4 py-3 rounded-lg border transition-all duration-200
  font-['Tiempos'] text-[${COLORS.charcoal}] placeholder-[${COLORS.lavender}]/60
  focus:outline-none focus:ring-2 focus:ring-[${COLORS.forestGreen}]/20 focus:border-[${COLORS.forestGreen}]
  disabled:bg-[${COLORS.oatMilk}] disabled:cursor-not-allowed disabled:opacity-60
`;

export const INPUT_STATES = {
  default: `border-[${COLORS.palePurple}] bg-white hover:border-[${COLORS.lavender}]/50`,
  error: `border-[${COLORS.dustyRose}] bg-[${COLORS.dustyRose}]/10`,
  success: `border-[${COLORS.mint}] bg-[${COLORS.mint}]/10`,
} as const;

export const LABEL_CLASSES = `
  block text-sm font-medium text-[${COLORS.charcoal}] mb-2
`;

export const REQUIRED_INDICATOR_CLASSES = `
  text-[${COLORS.apricot}] ml-1
`;

export const SELECT_BASE_CLASSES = `
  ${INPUT_BASE_CLASSES}
  bg-white cursor-pointer
`;

export type InputState = keyof typeof INPUT_STATES;
