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
        'deck-dark': '#0a0b10',
        'deck-card': '#131622',
        'deck-border': '#22283a',
        'deck-hover': '#1c2133',
        'neon-cyan': '#00f3ff',
        'neon-magenta': '#ff007f',
        'neon-yellow': '#ffe600',
        'neon-green': '#00ff66',
        'neon-purple': '#a855f7',
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 243, 255, 0.45)',
        'neon-magenta': '0 0 15px rgba(255, 0, 127, 0.45)',
        'neon-yellow': '0 0 15px rgba(255, 230, 0, 0.45)',
        'neon-green': '0 0 15px rgba(0, 255, 102, 0.45)',
        'deck-glow': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glowPulse: {
          '0%': { boxShadow: '0 0 5px rgba(0, 243, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 243, 255, 0.6)' },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
