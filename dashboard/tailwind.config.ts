import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f4f7f2',
          100: '#e5ece1',
          200: '#cbdbca',
          300: '#a7c1a5',
          400: '#7fa27c',
          500: '#5a8257',
          600: '#466743',
          700: '#385336',
          800: '#2f432d',
          900: '#273826',
          950: '#141e13',
        },
        cream: {
          50: '#fdfcf9',
          100: '#fbf8f2',
          200: '#f5f0e3',
          300: '#ede4ce',
          400: '#dfd2b2',
          500: '#cfbc94',
        },
        charcoal: {
          800: '#262d27',
          900: '#1a1f1b',
          950: '#0f1210',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      }
    },
  },
  plugins: [],
} satisfies Config;

