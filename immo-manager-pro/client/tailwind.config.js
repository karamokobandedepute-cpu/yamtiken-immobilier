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
        darkGreen: '#0D3B1F',
        midGreen: '#1A6B35',
        lightGreen: '#2D9E57',
        paleGreen: '#E8F5EC',
        gold: '#C8960C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
