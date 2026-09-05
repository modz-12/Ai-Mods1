/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0e0e10',
        surface: '#17171b',
        surface2: '#1f1f24',
        border: '#2b2b31',
        ink: '#f2f0ec',
        muted: '#8d8b92',
        accent: '#e23e57',
        'accent-hover': '#f0576f',
        teal: '#2fb8ac',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        md: '10px',
      },
    },
  },
  plugins: [],
};
