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
          DEFAULT: '#0b0d1b',
          100: '#101222',
          200: '#16182a',
        },
        surface: {
          DEFAULT: '#16182a',
          100: '#1c1e31',
          200: '#222439',
          300: '#282b41',
        },
        primary: {
          DEFAULT: '#ada3ff',
          dim: '#715eeb',
          container: '#9f93ff',
          glow: 'rgba(113,94,235,0.35)',
        },
        secondary: '#38bdf8',
        accent: '#ff9ec9',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#ff6e84',
        text: {
          DEFAULT: '#e7e6fb',
          muted: '#a9aabd',
          dim: '#737486',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(113,94,235,0.2), transparent)',
        'btn-primary': 'linear-gradient(135deg, #715eeb 0%, #5b46d4 100%)',
        'card-shine': 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)',
      },
      boxShadow: {
        'glow-sm': '0 0 16px rgba(113,94,235,0.2)',
        'glow': '0 0 28px rgba(113,94,235,0.3)',
        'glow-lg': '0 0 48px rgba(113,94,235,0.35)',
        'card': '0 2px 8px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(173,163,255,0.12) inset',
        'modal': '0 32px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset',
        'btn-glow': '0 8px 24px rgba(113,94,235,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
