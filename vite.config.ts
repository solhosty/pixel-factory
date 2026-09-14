import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4318',
        changeOrigin: false,
        // The development proxy keeps the per-launch token server-side. The
        // browser still never persists it; production uses the launch URL.
        headers: {
          Origin: 'http://127.0.0.1:5173',
          'X-Pixel-Harness-Token': process.env.PIXEL_HARNESS_TOKEN || ''
        }
      }
    }
  }
});
