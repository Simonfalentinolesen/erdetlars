import type { Config } from 'tailwindcss'

export default {
  content: [],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F1923',
          light: '#1A2634',
          dark: '#0A1119',
        },
        surface: '#1A2634',
        accent: {
          DEFAULT: '#F5A623',
          light: '#FFD166',
          dark: '#D4860A',
        },
        pink: {
          accent: '#E84393',
        },
        success: '#00D68F',
        error: '#FF4757',
        muted: '#8892A0',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(180deg, #0F1923 0%, #1A1A2E 100%)',
        'gradient-card': 'linear-gradient(135deg, #1A2634 0%, #0F1923 100%)',
        'glow-accent': 'radial-gradient(circle, rgba(245, 166, 35, 0.3) 0%, transparent 70%)',
        'glow-success': 'radial-gradient(circle, rgba(0, 214, 143, 0.3) 0%, transparent 70%)',
        'glow-error': 'radial-gradient(circle, rgba(255, 71, 87, 0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'card': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 12px 48px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 30px rgba(245, 166, 35, 0.4)',
        'glow-green': '0 0 30px rgba(0, 214, 143, 0.4)',
        'glow-red': '0 0 30px rgba(255, 71, 87, 0.4)',
        'button': '0 4px 16px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'score-pop': 'score-pop 0.6s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(245, 166, 35, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(245, 166, 35, 0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-10px)' },
          '40%': { transform: 'translateX(10px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' },
        },
        'score-pop': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
