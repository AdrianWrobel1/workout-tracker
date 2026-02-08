/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'set-complete': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '0.7' },
        },
        'chart-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'modal-fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-gentle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'set-complete': 'set-complete 0.12s ease-out',
        'chart-fade-in': 'chart-fade-in 0.4s ease-out forwards',
        'modal-fade-in': 'modal-fade-in 0.3s ease-out forwards',
        'pulse-gentle': 'pulse-gentle 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
