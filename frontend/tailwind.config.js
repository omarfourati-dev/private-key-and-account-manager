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
          DEFAULT: '#080812',
          100: '#0d0d1f',
          200: '#111128',
        },
        surface: {
          DEFAULT: '#14142b',
          100: '#1c1c38',
          200: '#232345',
        },
        primary: {
          DEFAULT: '#7c6af7',
          hover: '#6a57f0',
          glow: 'rgba(124,106,247,0.3)',
        },
        secondary: '#38bdf8',
        accent: '#fb7185',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
        text: {
          DEFAULT: '#e2e8f0',
          muted: '#64748b',
          dim: '#475569',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(124,106,247,0.25), transparent)',
        'card-shine': 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(124,106,247,0.15)',
        'glow': '0 0 24px rgba(124,106,247,0.2)',
        'glow-lg': '0 0 48px rgba(124,106,247,0.25)',
        'card': '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04) inset',
        'card-hover': '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,106,247,0.2) inset',
        'modal': '0 25px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
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
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};
