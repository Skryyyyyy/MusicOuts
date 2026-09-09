/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'deck-dark': '#08080a',
        'deck-card': '#111115',
        'deck-surface': '#18181e',
        'deck-border': '#26262e',
        'deck-hover': '#1f2027',
        'mono-black': '#050507',
        'mono-dark': '#0c0d10',
        'mono-card': '#14151a',
        'mono-border': '#282932',
        'mono-muted': '#71717a',
        'mono-silver': '#d4d4d8',
        'mono-white': '#ffffff',
        // Monochromatic aliases for high contrast
        'neon-cyan': '#ffffff',
        'neon-magenta': '#e4e4e7',
        'neon-yellow': '#d4d4d8',
        'neon-green': '#a1a1aa',
        'neon-purple': '#ffffff',
      },
      boxShadow: {
        'mono-glow': '0 0 25px rgba(255, 255, 255, 0.15)',
        'mono-subtle': '0 4px 20px rgba(0, 0, 0, 0.7)',
        'neon-cyan': '0 0 15px rgba(255, 255, 255, 0.25)',
        'neon-magenta': '0 0 15px rgba(228, 228, 231, 0.25)',
        'neon-yellow': '0 0 15px rgba(212, 212, 216, 0.25)',
        'neon-green': '0 0 15px rgba(161, 161, 170, 0.25)',
        'deck-glow': '0 8px 32px 0 rgba(0, 0, 0, 0.65)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glowPulse: {
          '0%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)' },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
