/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#05080f',
        surface: '#0d1117',
        'surface-2': '#161b22',
        border: '#21262d',
        primary: '#1d6bf3',
        'primary-light': '#4d8ef5',
        accent: '#00d4aa',
        muted: '#7a8ba8',
        foreground: '#e6edf3'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
