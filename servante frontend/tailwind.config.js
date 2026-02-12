/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', lg: '2rem' },
    },
    extend: {
      colors: {
        bg: '#f0f4f9',        // soft professional blue-tinted background
        navy: '#1e40af',      // professional deep blue
        cyansoft: '#0ea5e9',  // professional cyan blue
        glass: 'rgba(255,255,255,0.7)',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Poppins', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(16, 24, 40, 0.08)',
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
