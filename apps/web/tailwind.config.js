/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — #e83330 red
        brand: {
          50: '#FDECEB',
          100: '#FBD0CE',
          200: '#F6A9A6',
          300: '#F17E7A',
          400: '#EE5A55',
          500: '#EB423C',
          600: '#E83330',
          700: '#C71F1C',
          800: '#9A1613',
          900: '#6E0F0D',
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
          '0%': { boxShadow: '0 0 0 2px #F17E7A' },
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
