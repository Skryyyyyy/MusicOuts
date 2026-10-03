import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './core'),
      '@ml': path.resolve(__dirname, './ml'),
      '@apps': path.resolve(__dirname, './apps'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
