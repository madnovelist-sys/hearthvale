import { defineConfig } from 'vite';

// Tauri expects a fixed port in dev and serves the built files from dist/.
export default defineConfig({
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
} as any);
