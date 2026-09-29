import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  root: fileURLToPath(new URL('./ui/', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: { 
    outDir: 'dist', 
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./ui/index.html', import.meta.url)),
        delivery: fileURLToPath(new URL('./ui/delivery.html', import.meta.url)),
        orders: fileURLToPath(new URL('./ui/orders.html', import.meta.url))
      }
    }
  }
});
