/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // PANW NextWave brand palette
        panw: {
          navy: '#003B5C',
          blue: '#005B94',
          lightblue: '#0078BE',
          orange: '#FF6B35',
          teal: '#00A4B4',
          gray: {
            50: '#F8FAFB',
            100: '#EEF1F4',
            200: '#D4DAE1',
            300: '#B0B9C4',
            400: '#8A95A3',
            500: '#667080',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
          },
        },
        // Legacy navy palette (kept for backward compat, maps to panw values)
        navy: {
          50: '#eef2f7',
          100: '#d5dce8',
          200: '#b9c5d5',
          300: '#9cadc2',
          400: '#7f95af',
          500: '#627d9c',
          600: '#4c6580',
          700: '#364d63',
          800: '#1f3547',
          900: '#0a1d2c',
          950: '#050f18',
        },
        // Tier colors
        tier: {
          registered: '#6B7280',
          innovator: '#3B82F6',
          platinum: '#8B5CF6',
          diamond: '#D97706',
        },
        // Status colors
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#3B82F6',
          neutral: '#6B7280',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      boxShadow: {
        'panw': '0 1px 3px 0 rgba(0, 59, 92, 0.1), 0 1px 2px -1px rgba(0, 59, 92, 0.1)',
        'panw-md': '0 4px 6px -1px rgba(0, 59, 92, 0.1), 0 2px 4px -2px rgba(0, 59, 92, 0.1)',
        'panw-lg': '0 10px 15px -3px rgba(0, 59, 92, 0.1), 0 4px 6px -4px rgba(0, 59, 92, 0.1)',
      },
    },
  },
  plugins: [],
};
