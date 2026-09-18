/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nirmaan: {
          cream: '#F1EBDD',
          'cream-card': '#F7F3EA',
          black: '#141414',
          white: '#FFFFFF',
          blue: '#3357FF',
          amber: '#F5A623',
          orange: '#F2622E',
          red: '#E6432C',
          'green-dark': '#2F9E52',
          'green-bright': '#3ECF4A',
          purple: '#8B5CF6',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Archivo Black', 'Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'card-lg': '28px',
      },
      boxShadow: {
        'nirmaan': '0 8px 24px rgba(0,0,0,0.06)',
        'nirmaan-lg': '0 12px 32px rgba(0,0,0,0.08)',
        'nirmaan-solid': '4px 4px 0px #141414',
      }
    },
  },
  plugins: [],
}
