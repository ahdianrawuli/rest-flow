/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Fira Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xxs': '0.65rem',
        'xs': '0.75rem',
        'sm': '0.8125rem', // Diperkecil dari default 0.875rem
        'base': '0.875rem', // Diperkecil dari default 1rem
        'lg': '1rem', // Diperkecil dari default 1.125rem
      },
      colors: {
        slate: {
          850: '#151e2e', // Warna dark mode yang lebih deep
          900: '#0f172a',
        }
      }
    },
  },
  plugins: [],
}
