import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#3D7A5C',
        rust: '#C8522E',
        turmeric: '#E8B84B',
        indigo: '#5A3E7A',
        paper: '#FAF2E4',
        ink: '#2B2520',
      },
      fontFamily: {
        heading: ['Georgia', 'serif'],
        body: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
