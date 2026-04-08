/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#E8F1F8',
          100: '#d0e3f0',
          200: '#a1c7e1',
          300: '#72abd2',
          400: '#4390c3',
          500: '#1B5E8A',
          600: '#174f75',
          700: '#134060',
          800: '#0F314B',
          900: '#0D3B5E',
        },
        accent: {
          50:  '#FDF0E4',
          100: '#fce0c9',
          200: '#f9c193',
          300: '#f6a25d',
          400: '#D4792A',
          500: '#D4792A',
          600: '#E8611A',
          700: '#c0520e',
        },
        mgr: {
          grafite:    '#2D2D2D',
          cinza:      '#6B7280',
          cinzaClaro: '#F3F4F6',
          preto:      '#111111',
          sucesso:    '#16A34A',
          alerta:     '#EAB308',
          erro:       '#DC2626',
          info:       '#2563EB',
        }
      }
    },
  },
  plugins: [],
}