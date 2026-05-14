import type { Config } from 'tailwindcss';
import tradeSuitePreset from '@trades-saas/core-ui/tailwind';

const config: Config = {
  presets: [tradeSuitePreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Include core-ui components so their classes aren't purged
    '../../packages/core-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
