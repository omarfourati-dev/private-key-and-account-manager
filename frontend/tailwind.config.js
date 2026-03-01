/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#1e1e2e',
          100: '#181825',
          200: '#313244',
        },
        surface: {
          DEFAULT: '#313244',
          100: '#45475a',
          200: '#585b70',
        },
        primary: {
          DEFAULT: '#cba6f7',
          hover: '#b4befe',
        },
        secondary: '#89b4fa',
        accent: '#f38ba8',
        success: '#a6e3a1',
        warning: '#fab387',
        error: '#f38ba8',
        text: {
          DEFAULT: '#cdd6f4',
          muted: '#6c7086',
          dim: '#7f849c',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
