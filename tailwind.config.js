/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        whatsapp: {
          DEFAULT: '#25D366',
          dark: '#1da851',
          light: '#3ee27f',
        },
        surface: {
          950: '#0a0f14',
          900: '#0f151c',
          800: '#161e27',
          700: '#1e2833',
          600: '#2a3744',
        },
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(37, 211, 102, 0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
