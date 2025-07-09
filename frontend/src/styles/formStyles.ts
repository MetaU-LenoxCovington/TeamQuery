export const FORM_LAYOUTS = {
  container: 'w-full max-w-md mx-auto',
  spacing: 'space-y-6',
  header: 'text-center mb-8',
  footer: 'text-center',
} as const;

export const FORM_SECTIONS = {
  fieldGroup: 'space-y-4',
  buttonGroup: 'flex gap-3',
  toggleGroup: 'flex rounded-lg border border-[#D2DEEE] p-1 mb-4 bg-[#F8F5F2]',
} as const;

export const FORM_SPACING = {
  xs: 'space-y-2',
  sm: 'space-y-3',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
} as const;

export type FormLayout = keyof typeof FORM_LAYOUTS;
export type FormSection = keyof typeof FORM_SECTIONS;
export type FormSpacing = keyof typeof FORM_SPACING;
