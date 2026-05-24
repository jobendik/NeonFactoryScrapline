import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base — CrazyGames serves the game from a sandboxed iframe whose
  // path is not '/NeonFactoryRaid/'. Using './' makes asset URLs work on CG,
  // itch.io, file:// previews, and most static hosts without a redirect.
  base: './',
  publicDir: 'public',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
