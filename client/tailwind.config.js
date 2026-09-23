/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8',
        success: '#16A34A',
        warning: '#CA8A04',
        danger: '#DC2626',
        neutral: '#6B7280',
      },
    },
  },
  plugins: [],
};
