import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1360px' } },
    extend: {
      colors: {
        bg: 'hsl(var(--bg) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        raised: 'hsl(var(--raised) / <alpha-value>)',
        line: 'hsl(var(--line) / <alpha-value>)',
        ink: 'hsl(var(--ink) / <alpha-value>)',
        mute: 'hsl(var(--mute) / <alpha-value>)',
        amber: { DEFAULT: 'hsl(var(--amber) / <alpha-value>)', soft: 'hsl(var(--amber-soft) / <alpha-value>)' },
        ember: 'hsl(var(--ember) / <alpha-value>)',
        moss: 'hsl(var(--moss) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg: '0.625rem', md: '0.45rem', sm: '0.3rem' },
      boxShadow: {
        card: '0 1px 0 hsl(var(--line) / 0.6), 0 8px 24px -12px rgb(0 0 0 / 0.6)',
        pop: '0 12px 40px -10px rgb(0 0 0 / 0.7)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .25s ease-out both', 'sheet-up': 'sheet-up .25s ease-out both' },
    },
  },
  plugins: [],
};
export default config;
