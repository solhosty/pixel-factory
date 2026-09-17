import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const uiPort = Number(process.env.PIXEL_HARNESS_UI_PORT || 5173);
const servicePort = Number(process.env.PIXEL_HARNESS_SERVICE_PORT || 4318);

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '127.0.0.1', port: uiPort, strictPort: true,
    proxy: {
      '/api/v1': {
        target: `http://127.0.0.1:${servicePort}`,
        changeOrigin: false,
        // The development proxy keeps the per-launch token server-side. The
        // browser still never persists it; production uses the launch URL.
        headers: {
          Origin: `http://127.0.0.1:${uiPort}`,
          'X-Pixel-Harness-Token': process.env.PIXEL_HARNESS_TOKEN || ''
        }
      }
    }
  }
});
