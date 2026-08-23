/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F12',
        surface: '#1C1C22',
        accent: '#3B82F6',
        cyan: '#22D3EE',
        text: '#F5F5F7',
        muted: '#9CA3AF'
      },
      boxShadow: {
        glass: '0 8px 30px rgba(0, 0, 0, 0.35)',
        glow: '0 0 24px rgba(34, 211, 238, 0.25)'
      },
      fontFamily: {
        sans: ['SF Pro Display', 'SF Pro Text', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      keyframes: {
        pulseLine: {
          '0%': { opacity: '0.25' },
          '50%': { opacity: '0.85' },
          '100%': { opacity: '0.25' }
        },
        floatIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        pulseLine: 'pulseLine 3s ease-in-out infinite',
        floatIn: 'floatIn 0.5s ease-out forwards'
      }
    }
  },
  plugins: []
};
