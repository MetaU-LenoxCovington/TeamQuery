/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Forest Green (#25433B) variants
    'bg-[#25433B]',
    'bg-[#25433B]/90',
    'bg-[#25433B]/95',
    'bg-[#25433B]/50',
    'bg-[#25433B]/5',
    'bg-[#25433B]/10',
    'text-[#25433B]',
    'text-[#25433B]/50',
    'border-[#25433B]',
    'border-[#25433B]/50',
    'focus:ring-[#25433B]/50',
    'active:bg-[#25433B]/95',
    'active:bg-[#25433B]/10',
    'hover:bg-[#25433B]/5',
    'disabled:bg-[#25433B]/50',
    'disabled:text-[#25433B]/50',
    'disabled:border-[#25433B]/50',
    
    // Lavender (#747CAD) variants
    'bg-[#747CAD]',
    'bg-[#747CAD]/90',
    'bg-[#747CAD]/95',
    'bg-[#747CAD]/50',
    'text-[#747CAD]',
    'focus:ring-[#747CAD]/50',
    'active:bg-[#747CAD]/95',
    'disabled:bg-[#747CAD]/50',
  ],
  plugins: [],
}