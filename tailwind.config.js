/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./apps/**/*.{js,ts,jsx,tsx}",
    "./core/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pro: {
          bg: '#0D0E11',
          panel: '#15171C',
          surface: '#1E2028',
          border: '#282C37',
          accent: '#3B82F6',
          vocal: '#06B6D4',
          drum: '#F59E0B',
          bass: '#A855F7',
          other: '#10B981',
          playhead: '#FF3B30',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
