import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        marsdark: {
          "primary": "#6366f1",
          "primary-content": "#ffffff",
          "secondary": "#a78bfa",
          "secondary-content": "#ffffff",
          "accent": "#22d3ee",
          "accent-content": "#000000",
          "neutral": "#1e2433",
          "neutral-content": "#94a3b8",
          "base-100": "#0d1117",
          "base-200": "#161b27",
          "base-300": "#1e2433",
          "base-content": "#e2e8f0",
          "info": "#38bdf8",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        }
      }
    ],
    darkTheme: "marsdark",
  },
}
