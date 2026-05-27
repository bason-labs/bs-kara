/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surface2: 'var(--color-surface2)',
        border: 'var(--color-border)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
      },
    },
  },
  plugins: [],
};
