import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/raiz-e-ritmo/',
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'calendar-2027', test: /\/src\/data\/calendar-2027\.json$/ }],
        },
      },
    },
  },
  server: { host: '0.0.0.0' },
});
