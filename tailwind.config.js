/** @type {import('tailwindcss').Config} */

// As escalas `surface` e `content` NÃO são cores fixas: cada tom aponta para uma
// variável CSS definida em src/index.css, que troca de valor conforme o tema.
// Por isso o app inteiro usa as mesmas classes nos dois temas — `bg-surface-900`
// é "o fundo de um cartão", não "cinza escuro".
//
// O formato `rgb(var(--x) / <alpha-value>)` existe para os modificadores de
// opacidade continuarem funcionando: `bg-surface-900/80` só vale com ele.
const comAlpha = (variavel) => `rgb(var(${variavel}) / <alpha-value>)`

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
        // Texto sobre o verde. Fica escuro NOS DOIS temas de propósito: texto
        // claro sobre #25D366 dá contraste de ~2:1, reprovado em qualquer nível.
        onAccent: '#0a0f14',
        // Fundos e bordas — do mais ao fundo (950) para o mais à frente (600).
        surface: {
          950: comAlpha('--surface-950'),
          900: comAlpha('--surface-900'),
          800: comAlpha('--surface-800'),
          700: comAlpha('--surface-700'),
          600: comAlpha('--surface-600'),
        },
        // Texto — do mais forte (100) ao mais apagado (600).
        content: {
          100: comAlpha('--content-100'),
          200: comAlpha('--content-200'),
          300: comAlpha('--content-300'),
          400: comAlpha('--content-400'),
          500: comAlpha('--content-500'),
          600: comAlpha('--content-600'),
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
