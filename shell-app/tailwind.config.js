/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eef1f8',
          100: '#d5ddef',
          200: '#adbcdf',
          300: '#7a96c8',
          400: '#4f75b5',
          500: '#3458a0',
          600: '#2a4585',
          700: '#1B2A4A',  // Primary Navy
          800: '#162242',
          900: '#101a33',
        },
        gold: {
          400: '#e0b84e',
          500: '#C9A84C',  // Primary Gold
          600: '#b3923e',
        },
        srilanka: {
          red:    '#8D153A',
          gold:   '#C9A84C',
          maroon: '#6B1127',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
