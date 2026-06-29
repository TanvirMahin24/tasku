import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// `@tasku/types` ships TypeScript source (no prebuilt dist required for dev),
// so we alias it straight to the source entry. This keeps Vite happy whether or
// not the package has been compiled yet.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tasku/types': fileURLToPath(
        new URL('../../packages/types/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
});
