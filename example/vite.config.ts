import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Resolves `bd-map/react` to the package source so the example always
// runs against the code in this repository.
export default defineConfig({
  plugins: [react()],
  publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
  resolve: {
    alias: {
      'bd-map/react': fileURLToPath(new URL('../src/react/index.ts', import.meta.url)),
      'bd-map': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
  build: { outDir: 'dist' },
});
