/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SF Mono', 'Menlo', 'monospace']
      },
      colors: {
        ink: '#f0f0f0',
        paper: '#1c1c1c',
        s2: '#242424',
        s3: '#2a2a2a',
        s4: '#303030',
        s5: '#3a3a3a',
        border: '#333333',
        muted: '#6b7280',
        accent: {
          DEFAULT: '#c45d2e',
          light: '#3d2218',
          hover: '#d46a38'
        },
        label: {
          orange: '#FF9300',
          red: '#FC2847',
          yellow: '#FFC400',
          blue: '#007AFF',
          purple: '#BF5AF2',
          green: '#30D158',
          gray: '#8E8E93'
        },
        status: {
          backlog: '#6b7280',
          todo: '#4a9eca',
          in_progress: '#d4a843',
          done: '#4caf82'
        }
      }
    }
  },
  plugins: []
}
