/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Tori brand — Atlassian-style blue
        brand: {
          50: '#E9F2FF',
          100: '#CCE0FF',
          200: '#85B8FF',
          300: '#579DFF',
          400: '#388BFF',
          500: '#1868DB',
          600: '#0C66E4',
          700: '#0055CC',
          800: '#09326C',
          900: '#082145',
        },
        // Atlassian-ish neutrals for text/borders/surfaces
        ink: {
          DEFAULT: '#172B4D',
          soft: '#44546F',
          muted: '#5E6C84',
          faint: '#8590A2',
        },
        line: {
          DEFAULT: '#DCDFE4',
          soft: '#EBECF0',
        },
        surface: {
          page: '#F7F8F9',
          sunken: '#F1F2F4',
          hover: '#E9F2FF',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 1px rgba(9,30,66,.12)',
        raise: '0 4px 8px -2px rgba(9,30,66,.16), 0 0 1px rgba(9,30,66,.16)',
      },
      keyframes: {
        'ta-flash': {
          '0%': { boxShadow: '0 0 0 2px #4C9AFF' },
          '100%': { boxShadow: '0 1px 1px rgba(9,30,66,.12)' },
        },
      },
      animation: {
        'ta-flash': 'ta-flash 1s ease',
      },
    },
  },
  plugins: [],
};
