export const COLORS = {
  mint: '#DFF0DE',
  forestGreen: '#25433B',
  palePurple: '#D2DEEE',
  lavender: '#747CAD',
  dustyRose: '#FFC1BA',
  apricot: '#EA8B38',
  oatMilk: '#F8F5F2',
  charcoal: '#2F2F2F',
} as const;

export type ColorKey = keyof typeof COLORS;
