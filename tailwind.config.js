/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: '#090f1b',
          card: '#101a2b',
          glow: '#00e5ff',
          red: '#ff355e'
        }
      },
      boxShadow: {
        glow: '0 0 15px rgba(0, 229, 255, 0.5)',
        redglow: '0 0 20px rgba(255, 53, 94, 0.6)'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
