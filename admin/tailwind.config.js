/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Минималистичная палитра Komfort Go: глубокий графит, оттенки серого, чистый белый
        brand: {
          DEFAULT: '#1F2937',
          pressed: '#111827',
          tint: '#EEF0F2',
        },
        bg: '#FFFFFF',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F7F8F9',
        },
        line: '#ECECEC',
        text: {
          primary: '#1A1F25',
          secondary: '#8A94A0',
          muted: '#B4BCC6',
        },
        chip: {
          bg: '#F3F4F6',
          active: '#1F2937',
        },
      },
      borderRadius: {
        card: '14px',
        control: '9px',
        pill: '999px',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
