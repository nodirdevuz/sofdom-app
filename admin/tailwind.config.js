/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
